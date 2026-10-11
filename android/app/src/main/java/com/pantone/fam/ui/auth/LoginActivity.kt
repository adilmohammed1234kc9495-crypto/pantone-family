package com.pantone.fam.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.pantone.fam.PantoneApplication
import com.pantone.fam.data.repository.AuthRepository
import com.pantone.fam.databinding.ActivityLoginBinding
import com.pantone.fam.ui.main.MainActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val app = application as PantoneApplication
        authRepository = AuthRepository(app.apiClient.apiService, app.tokenStorage)

        // Session check: If valid tokens already present, jump straight to main
        if (authRepository.isLoggedIn()) {
            navigateToMain()
            return
        }

        updateServerDisplay()

        binding.tvServerConfig.setOnClickListener {
            showServerConfigDialog()
        }

        binding.btnLogin.setOnClickListener {
            performLogin()
        }
    }

    private fun updateServerDisplay() {
        val app = application as PantoneApplication
        binding.tvServerConfig.text = "Server: ${app.apiClient.getBaseUrl()}\n(Tap to configure)"
    }

    private fun showServerConfigDialog() {
        val app = application as PantoneApplication
        val currentUrl = app.apiClient.getBaseUrl()

        val input = com.google.android.material.textfield.TextInputEditText(this).apply {
            setText(currentUrl)
            setSelection(currentUrl.length)
            hint = "https://pantone-family.onrender.com/api/v1/"
        }

        val container = android.widget.FrameLayout(this).apply {
            val pad = (20 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad / 2, pad, pad / 2)
            addView(input)
        }

        com.google.android.material.dialog.MaterialAlertDialogBuilder(this)
            .setTitle("Server Environment")
            .setMessage("Production API URL: https://pantone-family.onrender.com/api/v1/\nEnter custom server URL or select an environment profile:")
            .setView(container)
            .setPositiveButton("Save") { _, _ ->
                var newUrl = input.text?.toString()?.trim().orEmpty()
                if (newUrl.isNotBlank()) {
                    if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
                        newUrl = "https://$newUrl"
                    }
                    if (!newUrl.endsWith("/")) {
                        newUrl = "$newUrl/"
                    }

                    // Enforce HTTPS for non-loopback endpoints in production builds
                    if (!com.pantone.fam.BuildConfig.DEBUG && newUrl.startsWith("http://") &&
                        !newUrl.contains("127.0.0.1") && !newUrl.contains("localhost") && !newUrl.contains("10.0.2.2")
                    ) {
                        android.widget.Toast.makeText(this, "Production builds require HTTPS", android.widget.Toast.LENGTH_LONG).show()
                        return@setPositiveButton
                    }

                    app.apiClient.updateBaseUrl(newUrl)
                    authRepository = AuthRepository(app.apiClient.apiService, app.tokenStorage)
                    updateServerDisplay()
                    android.widget.Toast.makeText(this, "Server URL updated", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .setNeutralButton("Reset Default") { _, _ ->
                app.tokenStorage.setServerBaseUrl("")
                app.apiClient.updateBaseUrl(com.pantone.fam.BuildConfig.API_BASE_URL)
                authRepository = AuthRepository(app.apiClient.apiService, app.tokenStorage)
                updateServerDisplay()
                android.widget.Toast.makeText(this, "Reset to production default: ${com.pantone.fam.BuildConfig.API_BASE_URL}", android.widget.Toast.LENGTH_SHORT).show()
            }
            .show()
    }

    private fun performLogin() {
        val username = binding.etUsername.text?.toString()?.trim().orEmpty()
        val password = binding.etPassword.text?.toString()?.trim().orEmpty()

        if (username.isEmpty()) {
            binding.tilUsername.error = "Username is required"
            return
        } else {
            binding.tilUsername.error = null
        }

        if (password.isEmpty()) {
            binding.tilPassword.error = "Password is required"
            return
        } else {
            binding.tilPassword.error = null
        }

        setLoading(true)

        lifecycleScope.launch(Dispatchers.IO) {
            val result = authRepository.login(username, password)
            withContext(Dispatchers.Main) {
                setLoading(false)
                result.onSuccess {
                    navigateToMain()
                }.onFailure { error ->
                    binding.tvErrorMessage.text = error.message ?: "Authentication failed"
                    binding.tvErrorMessage.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun setLoading(isLoading: Boolean) {
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.btnLogin.isEnabled = !isLoading
        binding.etUsername.isEnabled = !isLoading
        binding.etPassword.isEnabled = !isLoading
        if (isLoading) {
            binding.tvErrorMessage.visibility = View.GONE
        }
    }

    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
        finish()
    }
}