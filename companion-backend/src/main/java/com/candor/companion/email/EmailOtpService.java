package com.candor.companion.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class EmailOtpService {
    private static final Logger log = LoggerFactory.getLogger(EmailOtpService.class);
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern CODE_PATTERN = Pattern.compile("^\\d{6}$");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration OTP_TTL = Duration.ofMinutes(5);
    private static final Duration VERIFIED_TTL = Duration.ofMinutes(10);
    private static final Duration SEND_COOLDOWN = Duration.ofSeconds(60);
    private static final Duration SEND_WINDOW = Duration.ofHours(1);
    private static final int MAX_SENDS_PER_HOUR = 5;
    private static final int MAX_VERIFY_ATTEMPTS = 5;

    private final StringRedisTemplate redis;
    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String senderEmail;

    @Value("${spring.mail.password:}")
    private String senderPassword;

    @Value("${email-otp.hash-secret:}")
    private String hashSecret;

    public EmailOtpService(StringRedisTemplate redis, JavaMailSender mailSender) {
        this.redis = redis;
        this.mailSender = mailSender;
    }

    public String send(String rawEmail) {
        String email = normalize(rawEmail);
        validateEmail(email);
        requireConfiguration();

        String cooldownKey = key("send-cooldown", email);
        Boolean cooldownSet = redis.opsForValue().setIfAbsent(cooldownKey, "1", SEND_COOLDOWN);
        if (!Boolean.TRUE.equals(cooldownSet)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Please wait a minute before requesting another code.");
        }

        String sendsKey = key("sends-hour", email);
        Long sends = redis.opsForValue().increment(sendsKey);
        if (sends != null && sends == 1L) redis.expire(sendsKey, SEND_WINDOW);
        if (sends == null || sends > MAX_SENDS_PER_HOUR) {
            redis.delete(cooldownKey);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many codes requested. Please try again in an hour.");
        }

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        String codeKey = key("code", email);
        redis.opsForValue().set(codeKey, hashOtp(email, code), OTP_TTL);
        redis.delete(List.of(key("verify-attempts", email), key("verified", email)));

        try {
            if (mailSender instanceof JavaMailSenderImpl implementation) {
                implementation.setPassword(senderPassword.replaceAll("\\s+", ""));
            }
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(senderEmail.trim());
            message.setTo(email);
            message.setSubject("Your MediCare verification code");
            message.setText("Your MediCare signup verification code is " + code
                    + ". It expires in 5 minutes. If you did not request it, you can ignore this email.");
            mailSender.send(message);
            return "Verification code sent. It expires in 5 minutes.";
        } catch (Exception error) {
            redis.delete(List.of(codeKey, cooldownKey));
            log.warn("Signup OTP email delivery failed: {}", error.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "We could not send the verification email. Please try again shortly.");
        }
    }

    public String verify(String rawEmail, String rawCode) {
        String email = normalize(rawEmail);
        String code = rawCode == null ? "" : rawCode.trim();
        validateEmail(email);
        if (!CODE_PATTERN.matcher(code).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the 6-digit code from your email.");
        }
        requireConfiguration();

        String codeKey = key("code", email);
        String storedHash = redis.opsForValue().get(codeKey);
        if (storedHash == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That code has expired. Request a new one.");
        }

        String attemptsKey = key("verify-attempts", email);
        Long attempts = redis.opsForValue().increment(attemptsKey);
        if (attempts != null && attempts == 1L) redis.expire(attemptsKey, OTP_TTL);

        if (attempts == null || attempts > MAX_VERIFY_ATTEMPTS || !matchesOtp(email, code, storedHash)) {
            if (attempts == null || attempts >= MAX_VERIFY_ATTEMPTS) {
                redis.delete(List.of(codeKey, attemptsKey));
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Too many incorrect attempts. Request a new code.");
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That code is incorrect. Please check it and try again.");
        }

        redis.delete(List.of(codeKey, attemptsKey));
        redis.opsForValue().set(key("verified", email), "1", VERIFIED_TTL);
        return "Email verified. You can continue creating your account.";
    }

    private void requireConfiguration() {
        if (senderEmail == null || senderEmail.isBlank()
                || senderPassword == null || senderPassword.isBlank()
                || hashSecret == null || hashSecret.length() < 32) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Email verification is not configured on the Java service.");
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static void validateEmail(String email) {
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        }
    }

    private String hashOtp(String email, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hashSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((email + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("Unable to hash email verification code", error);
        }
    }

    private boolean matchesOtp(String email, String code, String storedHash) {
        byte[] expected = hashOtp(email, code).getBytes(StandardCharsets.US_ASCII);
        byte[] actual = storedHash.getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected, actual);
    }

    private static String key(String kind, String email) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(email.getBytes(StandardCharsets.UTF_8));
            return "signup-email:" + kind + ":" + HexFormat.of().formatHex(digest);
        } catch (Exception error) {
            throw new IllegalStateException("Unable to create email verification key", error);
        }
    }
}
