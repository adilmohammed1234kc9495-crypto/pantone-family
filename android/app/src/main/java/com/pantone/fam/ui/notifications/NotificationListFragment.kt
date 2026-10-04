package com.pantone.fam.ui.notifications

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.pantone.fam.PantoneApplication
import com.pantone.fam.data.repository.NotificationRepository
import com.pantone.fam.databinding.FragmentNotificationsBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class NotificationListFragment : Fragment() {

    private var _binding: FragmentNotificationsBinding? = null
    private val binding get() = _binding!!

    private lateinit var notifRepo: NotificationRepository
    private lateinit var adapter: NotificationAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentNotificationsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val app = requireActivity().application as PantoneApplication
        notifRepo = NotificationRepository(app.apiClient.apiService)

        adapter = NotificationAdapter { item ->
            if (!item.isRead) {
                markRead(item.id)
            }
        }

        binding.recyclerViewNotifications.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerViewNotifications.adapter = adapter

        binding.swipeRefresh.setOnRefreshListener {
            loadNotifications()
        }

        binding.btnMarkAllRead.setOnClickListener {
            markAllRead()
        }

        loadNotifications()
    }

    private fun loadNotifications() {
        binding.swipeRefresh.isRefreshing = true

        viewLifecycleOwner.lifecycleScope.launch(Dispatchers.IO) {
            val result = notifRepo.getNotifications()
            withContext(Dispatchers.Main) {
                if (_binding != null) {
                    binding.swipeRefresh.isRefreshing = false
                    result.onSuccess { list ->
                        adapter.submitList(list)
                    }.onFailure { error ->
                        Toast.makeText(requireContext(), error.message ?: "Failed to load notifications", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    private fun markRead(id: String) {
        viewLifecycleOwner.lifecycleScope.launch(Dispatchers.IO) {
            notifRepo.markAsRead(id)
            withContext(Dispatchers.Main) {
                loadNotifications()
            }
        }
    }

    private fun markAllRead() {
        binding.swipeRefresh.isRefreshing = true
        viewLifecycleOwner.lifecycleScope.launch(Dispatchers.IO) {
            val result = notifRepo.markAllAsRead()
            withContext(Dispatchers.Main) {
                if (_binding != null) {
                    binding.swipeRefresh.isRefreshing = false
                    result.onSuccess {
                        Toast.makeText(requireContext(), "All marked as read", Toast.LENGTH_SHORT).show()
                        loadNotifications()
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