package com.pantone.fam.ui.assets

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.pantone.fam.PantoneApplication
import com.pantone.fam.R
import com.pantone.fam.data.model.Asset
import com.pantone.fam.data.repository.AssetRepository
import com.pantone.fam.data.repository.CustodyRepository
import com.pantone.fam.data.repository.MaintenanceRepository
import com.pantone.fam.databinding.ActivityAssetDetailBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AssetDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAssetDetailBinding
    private lateinit var assetRepo: AssetRepository
    private lateinit var custodyRepo: CustodyRepository
    private lateinit var maintenanceRepo: MaintenanceRepository

    private var currentAsset: Asset? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAssetDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val app = application as PantoneApplication
        assetRepo = AssetRepository(app.apiClient.apiService)
        custodyRepo = CustodyRepository(app.apiClient.apiService)
        maintenanceRepo = MaintenanceRepository(app.apiClient.apiService)

        val assetId = intent.getStringExtra(EXTRA_ASSET_ID)
        if (assetId.isNullOrBlank()) {
            Toast.makeText(this, "Asset ID missing", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        setupActions()
        loadAssetDetail(assetId)
    }

    private fun loadAssetDetail(assetId: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            val result = assetRepo.getAssetDetail(assetId)
            withContext(Dispatchers.Main) {
                result.onSuccess { asset ->
                    currentAsset = asset
                    renderAsset(asset)
                }.onFailure { error ->
                    Toast.makeText(this@AssetDetailActivity, error.message ?: "Failed to load details", Toast.LENGTH_LONG).show()
                    finish()
                }
            }
        }
    }

    private fun renderAsset(asset: Asset) {
        binding.tvDetailAssetTag.text = asset.assetTag
        binding.tvDetailAssetName.text = asset.name
        binding.tvDetailCategory.text = asset.categoryName ?: "General"

        val loc = listOfNotNull(asset.departmentName, asset.locationName).joinToString(" • ")
        binding.tvDetailLocation.text = if (loc.isNotBlank()) loc else "Central Depot"

        binding.tvDetailCustodian.text = asset.currentCustodianName ?: "Unassigned (In Storage)"
        val bookVal = asset.currentBookValue ?: asset.purchaseCost
        binding.tvDetailBookValue.text = if (bookVal != null) "$${"%,.2f".format(bookVal)}" else "--"

        binding.tvDetailStatusBadge.text = asset.status.replace("_", " ")

        when (asset.status) {
            "IN_SERVICE", "AVAILABLE" -> {
                binding.tvDetailStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.status_green_text))
                binding.btnAssign.visibility = View.VISIBLE
                binding.btnReturn.visibility = View.GONE
            }
            "ASSIGNED" -> {
                binding.tvDetailStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.status_blue_text))
                binding.btnAssign.visibility = View.GONE
                binding.btnReturn.visibility = View.VISIBLE
            }
            "UNDER_MAINTENANCE", "MAINTENANCE" -> {
                binding.tvDetailStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.status_amber_text))
                binding.btnAssign.visibility = View.GONE
                binding.btnReturn.visibility = View.GONE
            }
            else -> {
                binding.tvDetailStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.status_red_text))
                binding.btnAssign.visibility = View.GONE
                binding.btnReturn.visibility = View.GONE
            }
        }
    }

    private fun setupActions() {
        binding.btnAssign.setOnClickListener {
            val asset = currentAsset ?: return@setOnClickListener
            AlertDialog.Builder(this)
                .setTitle("Assign Custody")
                .setMessage("Assign ${asset.assetTag} (${asset.name}) to operator?")
                .setPositiveButton("Confirm") { _, _ ->
                    performAssignment(asset.id)
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        binding.btnReturn.setOnClickListener {
            val asset = currentAsset ?: return@setOnClickListener
            AlertDialog.Builder(this)
                .setTitle("Initiate Custody Return")
                .setMessage("Return ${asset.assetTag} to storage depot after physical inspection?")
                .setPositiveButton("Return") { _, _ ->
                    Toast.makeText(this, "Return record created for inspection", Toast.LENGTH_SHORT).show()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        binding.btnMaintenance.setOnClickListener {
            val asset = currentAsset ?: return@setOnClickListener
            AlertDialog.Builder(this)
                .setTitle("Create Maintenance Work Order")
                .setMessage("Submit work order for ${asset.assetTag}?")
                .setPositiveButton("Submit") { _, _ ->
                    performMaintenanceRequest(asset.id)
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    private fun performAssignment(assetId: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            val user = (application as PantoneApplication).tokenStorage.getUser()
            val employeeId = user?.id ?: ""
            val result = custodyRepo.createAssignment(assetId, employeeId, "GOOD", "Mobile self-service custody assignment")
            withContext(Dispatchers.Main) {
                result.onSuccess {
                    Toast.makeText(this@AssetDetailActivity, "Custody assigned successfully", Toast.LENGTH_SHORT).show()
                    loadAssetDetail(assetId)
                }.onFailure { error ->
                    Toast.makeText(this@AssetDetailActivity, error.message ?: "Assignment failed", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun performMaintenanceRequest(assetId: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            val result = maintenanceRepo.createWorkOrder(
                assetId = assetId,
                title = "Routine Mobile Inspection & Service",
                description = "Reported via mobile application diagnostic sweep",
                priority = "MEDIUM"
            )
            withContext(Dispatchers.Main) {
                result.onSuccess {
                    Toast.makeText(this@AssetDetailActivity, "Maintenance work order initiated", Toast.LENGTH_SHORT).show()
                    loadAssetDetail(assetId)
                }.onFailure { error ->
                    Toast.makeText(this@AssetDetailActivity, error.message ?: "Request failed", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    companion object {
        const val EXTRA_ASSET_ID = "com.pantone.fam.EXTRA_ASSET_ID"
    }
}