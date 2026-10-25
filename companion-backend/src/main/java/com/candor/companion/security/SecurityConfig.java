package com.candor.companion.security;

import com.candor.companion.domain.ProfileStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Endpoint-level authorization, wired directly to the Role-to-Capability
 * matrix in SUBMISSION.md Section 5.2 / Appendix A2:
 *
 *   Capability            Policyholder   Beneficiary
 *   Policy Q&A             Yes            Yes
 *   Claims                 Yes            Yes
 *   What-If                Yes            No
 *   Self-service updates   Yes            No
 *
 * This is the layer that makes the security model real rather than
 * aspirational: the frontend hiding a button is presentation, this
 * config is enforcement. Every rule below is checked on every request —
 * there is no session/cookie state to "already be logged in" against.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                            MockJwtService jwtService,
                                            ProfileStore profileStore) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // stateless bearer-token API, no cookies/CSRF surface
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Dev-only: stands in for the host app's login/handoff issuance.
                // Must be removed or locked down before any non-local deployment.
                .requestMatchers("/api/dev/**").permitAll()
                .requestMatchers("/api/email-otp/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()

                // Policy Q&A, RAG, and Claims: both roles.
                .requestMatchers("/api/qa/**", "/api/rag/**", "/api/claims/**")
                    .hasAnyRole("POLICYHOLDER", "BENEFICIARY")

                // What-If and self-service updates: policyholder only.
                .requestMatchers("/api/what-if/**", "/api/self-service/**")
                    .hasRole("POLICYHOLDER")

                .anyRequest().authenticated()
            )
            .addFilterBefore(
                new JwtAuthenticationFilter(jwtService, profileStore),
                UsernamePasswordAuthenticationFilter.class
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) ->
                    response.sendError(
                        jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED,
                        "Unauthorised"
                    )
                )
            );

        return http.build();
    }
}
