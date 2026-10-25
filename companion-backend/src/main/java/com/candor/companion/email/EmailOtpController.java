package com.candor.companion.email;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/email-otp")
public class EmailOtpController {
    private final EmailOtpService emailOtpService;

    public EmailOtpController(EmailOtpService emailOtpService) {
        this.emailOtpService = emailOtpService;
    }

    public record SendRequest(@NotBlank @Email String email) {}
    public record VerifyRequest(@NotBlank @Email String email, @NotBlank String code) {}

    @PostMapping("/send")
    public ResponseEntity<Map<String, String>> send(@Valid @RequestBody SendRequest request) {
        return ResponseEntity.ok(Map.of("message", emailOtpService.send(request.email())));
    }

    @PostMapping("/verify")
    public ResponseEntity<Map<String, String>> verify(@Valid @RequestBody VerifyRequest request) {
        return ResponseEntity.ok(Map.of("message", emailOtpService.verify(request.email(), request.code())));
    }
}
