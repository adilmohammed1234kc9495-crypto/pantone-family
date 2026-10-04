package com.pantone.fam.ui.main

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.pantone.fam.PantoneApplication
import com.pantone.fam.R
import com.pantone.fam.data.repository.AuthRepository
import com.pantone.fam.databinding.ActivityMainBinding
import com.pantone.fam.ui.assets.AssetListFragment
import com.pantone.fam.ui.auth.LoginActivity
import com.pantone.fam.ui.dashboard.DashboardFragment
import com.pantone.fam.ui.notifications.NotificationListFragment
import com.pantone.fam.ui.scan.ScannerActivity
import com.pantone.fam.ui.tasks.TasksFragment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val app = application as PantoneApplication
        authRepository = AuthRepository(app.apiClient.apiService, app.tokenStorage)

        if (!authRepository.isLoggedIn()) {
            redirectToLogin()
            return
        }

        setupHeader()
        setupBottomNav()

        if (savedInstanceState == null) {
            switchFragment(DashboardFragment())
        }
    }

    private fun setupHeader() {
        val user = authRepository.getCurrentUser()
        if (user != null) {
            val role = user.roleCode ?: user.roleName ?: if (user.isCommonAdmin) "COMMON_ADMIN" else "USER"
            binding.tvUserBadge.text = role.replace("_", " ")
            binding.tvCompanyScope.text = when {
                user.isCommonAdmin -> "Global System Context"
                user.companyName != null -> "Company: ${user.companyName}"
                user.companyId != null -> "Company Scope: ${user.companyId}"
                else -> "Tenant Context"
            }
        }

        binding.btnLogout.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Sign Out")
                .setMessage("Are you sure you want to end your active session?")
                .setPositiveButton("Sign Out") { _, _ ->
                    performLogout()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    private fun performLogout() {
        lifecycleScope.launch(Dispatchers.IO) {
            authRepository.logout()
            withContext(Dispatchers.Main) {
                redirectToLogin()
            }
        }
    }

    private fun redirectToLogin() {
        val intent = Intent(this, LoginActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
        finish()
    }

    private fun setupBottomNav() {
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_home -> {
                    switchFragment(DashboardFragment())
                    true
                }
                R.id.nav_assets -> {
                    switchFragment(AssetListFragment())
                    true
                }
                R.id.nav_scan -> {
                    startActivity(Intent(this, ScannerActivity::class.java))
                    false // Don't select tab since scanner is a separate activity
                }
                R.id.nav_tasks -> {
                    switchFragment(TasksFragment())
                    true
                }
                R.id.nav_notifications -> {
                    switchFragment(NotificationListFragment())
                    true
                }
                else -> false
            }
        }
    }

    private fun switchFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
    }
}