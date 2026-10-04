package com.pantone.fam.ui.scan

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.pantone.fam.PantoneApplication
import com.pantone.fam.data.repository.ScanRepository
import com.pantone.fam.databinding.ActivityScannerBinding
import com.pantone.fam.ui.assets.AssetDetailActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class ScannerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityScannerBinding
    private lateinit var scanRepo: ScanRepository
    private lateinit var cameraExecutor: ExecutorService
    private var isResolving = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityScannerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val app = application as PantoneApplication
        scanRepo = ScanRepository(app.apiClient.apiService)
        cameraExecutor = Executors.newSingleThreadExecutor()

        binding.btnManualEntry.setOnClickListener {
            showManualInputDialog()
        }

        if (allPermissionsGranted()) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(
                this,
                REQUIRED_PERMISSIONS,
                REQUEST_CODE_PERMISSIONS
            )
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder()
                .build()
                .also {
                    it.setSurfaceProvider(binding.previewView.surfaceProvider)
                }

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor, BarcodeAnalyzer { rawCode ->
                        if (!isResolving) {
                            runOnUiThread {
                                handleScannedCode(rawCode)
                            }
                        }
                    })
                }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this,
                    cameraSelector,
                    preview,
                    imageAnalyzer
                )
            } catch (exc: Exception) {
                Toast.makeText(this, "Failed to start camera: ${exc.message}", Toast.LENGTH_SHORT).show()
            }

        }, ContextCompat.getMainExecutor(this))
    }

    private fun handleScannedCode(rawCode: String) {
        if (isResolving) return
        isResolving = true
        binding.scanProgressBar.visibility = View.VISIBLE

        lifecycleScope.launch(Dispatchers.IO) {
            val result = scanRepo.resolveScanToken(rawCode)
            withContext(Dispatchers.Main) {
                binding.scanProgressBar.visibility = View.GONE
                result.onSuccess { resolution ->
                    Toast.makeText(this@ScannerActivity, "Identified: ${resolution.asset.name}", Toast.LENGTH_SHORT).show()
                    val intent = Intent(this@ScannerActivity, AssetDetailActivity::class.java).apply {
                        putExtra(AssetDetailActivity.EXTRA_ASSET_ID, resolution.asset.id)
                    }
                    startActivity(intent)
                    finish()
                }.onFailure { error ->
                    showScanErrorDialog(error.message ?: "Failed to resolve barcode")
                }
            }
        }
    }

    private fun showScanErrorDialog(message: String) {
        AlertDialog.Builder(this)
            .setTitle("Scan Identification Error")
            .setMessage(message)
            .setPositiveButton("Scan Again") { dialog, _ ->
                dialog.dismiss()
                isResolving = false
            }
            .setCancelable(false)
            .show()
    }

    private fun showManualInputDialog() {
        val input = EditText(this).apply {
            hint = "e.g. AST-DEL-0001 or asset:<uuid>"
            setSingleLine()
        }

        AlertDialog.Builder(this)
            .setTitle("Manual Asset Identification")
            .setMessage("Enter the asset tag or QR identifier:")
            .setView(input)
            .setPositiveButton("Resolve") { _, _ ->
                val code = input.text.toString().trim()
                if (code.isNotEmpty()) {
                    handleScannedCode(code)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun allPermissionsGranted() = REQUIRED_PERMISSIONS.all {
        ContextCompat.checkSelfPermission(baseContext, it) == PackageManager.PERMISSION_GRANTED
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CODE_PERMISSIONS) {
            if (allPermissionsGranted()) {
                startCamera()
            } else {
                Toast.makeText(this, "Camera permission is required for optical scanning", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }

    companion object {
        private const val REQUEST_CODE_PERMISSIONS = 101
        private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA)
    }
}