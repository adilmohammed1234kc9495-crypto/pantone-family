package com.pantone.fam.ui.dashboard

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.pantone.fam.PantoneApplication
import com.pantone.fam.data.repository.DashboardRepository
import com.pantone.fam.databinding.FragmentDashboardBinding
import com.pantone.fam.ui.scan.ScannerActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class DashboardFragment : Fragment() {

    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!

    private lateinit var dashboardRepo: DashboardRepository

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val app = requireActivity().application as PantoneApplication
        dashboardRepo = DashboardRepository(app.apiClient.apiService)

        binding.btnQuickScan.setOnClickListener {
            val intent = Intent(requireContext(), ScannerActivity::class.java)
            startActivity(intent)
        }

        binding.swipeRefresh.setOnRefreshListener {
            loadDashboardMetrics()
        }

        loadDashboardMetrics()
    }

    private fun loadDashboardMetrics() {
        binding.swipeRefresh.isRefreshing = true

        viewLifecycleOwner.lifecycleScope.launch(Dispatchers.IO) {
            val result = dashboardRepo.getStats()
            withContext(Dispatchers.Main) {
                if (_binding != null) {
                    binding.swipeRefresh.isRefreshing = false
                    result.onSuccess { stats ->
                        binding.tvTotalAssets.text = stats.totalAssets.toString()
                        binding.tvInServiceAssets.text = stats.inServiceAssets.toString()
                        binding.tvMaintenanceAssets.text = stats.maintenanceAssets.toString()
                        binding.tvPendingApprovals.text = stats.pendingApprovals.toString()
                        binding.tvApiStatus.text = "Connected • All services operational"
                    }.onFailure {
                        binding.tvApiStatus.text = "Offline Mode / Disconnected"
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}