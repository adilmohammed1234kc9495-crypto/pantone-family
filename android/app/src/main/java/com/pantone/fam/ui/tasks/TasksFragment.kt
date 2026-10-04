package com.pantone.fam.ui.tasks

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.pantone.fam.PantoneApplication
import com.pantone.fam.data.model.Requisition
import com.pantone.fam.data.repository.RequisitionRepository
import com.pantone.fam.databinding.FragmentTasksBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class TasksFragment : Fragment() {

    private var _binding: FragmentTasksBinding? = null
    private val binding get() = _binding!!

    private lateinit var requisitionRepo: RequisitionRepository
    private lateinit var adapter: TasksAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentTasksBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val app = requireActivity().application as PantoneApplication
        requisitionRepo = RequisitionRepository(app.apiClient.apiService)

        adapter = TasksAdapter(
            onApprove = { req -> promptApprove(req) },
            onReject = { req -> promptReject(req) }
        )

        binding.recyclerViewTasks.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerViewTasks.adapter = adapter

        binding.swipeRefresh.setOnRefreshListener {
            loadTasks()
        }

        loadTasks()
    }

    private fun loadTasks() {
        binding.swipeRefresh.isRefreshing = true

        viewLifecycleOwner.lifecycleScope.launch(Dispatchers.IO) {
            val result = requisitionRepo.getRequisitions()
            withContext(Dispatchers.Main) {
                if (_binding != null) {
                    binding.swipeRefresh.isRefreshing = false
                    result.onSuccess { list ->
                        adapter.submitList(list)
                    }.onFailure { error ->
                        Toast.makeText(requireContext(), error.message ?: "Failed to load tasks", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    private fun promptApprove(req: Requisition) {
        val stageId = req.approvals?.firstOrNull { it.status == "PENDING" }?.id ?: req.id
        AlertDialog.Builder(requireContext())
            .setTitle("Confirm Approval")
            .setMessage("Approve ${req.requestNumber ?: "requisition"}?")
            .setPositiveButton("Approve") { _, _ ->
                processDecision(stageId, isApprove = true)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun promptReject(req: Requisition) {
        val stageId = req.approvals?.firstOrNull { it.status == "PENDING" }?.id ?: req.id
        AlertDialog.Builder(requireContext())
            .setTitle("Confirm Rejection")
            .setMessage("Reject ${req.requestNumber ?: "requisition"}?")
            .setPositiveButton("Reject") { _, _ ->
                processDecision(stageId, isApprove = false)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun processDecision(stageId: String, isApprove: Boolean) {
        binding.swipeRefresh.isRefreshing = true
        viewLifecycleOwner.lifecycleScope.launch(Dispatchers.IO) {
            val result = if (isApprove) {
                requisitionRepo.approve(stageId, "Approved via Pantone Mobile FAM")
            } else {
                requisitionRepo.reject(stageId, "Rejected via Pantone Mobile FAM")
            }

            withContext(Dispatchers.Main) {
                if (_binding != null) {
                    binding.swipeRefresh.isRefreshing = false
                    result.onSuccess {
                        Toast.makeText(requireContext(), if (isApprove) "Approved successfully" else "Requisition rejected", Toast.LENGTH_SHORT).show()
                        loadTasks()
                    }.onFailure { error ->
                        Toast.makeText(requireContext(), error.message ?: "Action failed", Toast.LENGTH_LONG).show()
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