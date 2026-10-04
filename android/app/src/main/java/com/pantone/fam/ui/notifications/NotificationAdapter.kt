package com.pantone.fam.ui.notifications

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.pantone.fam.R
import com.pantone.fam.data.model.NotificationItem
import com.pantone.fam.databinding.ItemNotificationBinding

class NotificationAdapter(
    private val onNotificationClick: (NotificationItem) -> Unit
) : ListAdapter<NotificationItem, NotificationAdapter.NotificationViewHolder>(DiffCallback) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): NotificationViewHolder {
        val binding = ItemNotificationBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return NotificationViewHolder(binding, onNotificationClick)
    }

    override fun onBindViewHolder(holder: NotificationViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class NotificationViewHolder(
        private val binding: ItemNotificationBinding,
        private val onNotificationClick: (NotificationItem) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: NotificationItem) {
            binding.tvNotificationTitle.text = item.title
            binding.tvNotificationMessage.text = item.message
            binding.tvSeverityBadge.text = item.severity
            binding.tvNotificationDate.text = item.createdAt?.take(10) ?: "Recent"

            binding.unreadIndicator.visibility = if (item.isRead) View.GONE else View.VISIBLE

            val context = binding.root.context
            when (item.severity.uppercase()) {
                "CRITICAL", "ERROR" -> {
                    binding.tvSeverityBadge.setTextColor(ContextCompat.getColor(context, R.color.status_red_text))
                }
                "WARNING" -> {
                    binding.tvSeverityBadge.setTextColor(ContextCompat.getColor(context, R.color.status_amber_text))
                }
                else -> {
                    binding.tvSeverityBadge.setTextColor(ContextCompat.getColor(context, R.color.status_blue_text))
                }
            }

            binding.root.setOnClickListener {
                onNotificationClick(item)
            }
        }
    }

    companion object DiffCallback : DiffUtil.ItemCallback<NotificationItem>() {
        override fun areItemsTheSame(oldItem: NotificationItem, newItem: NotificationItem): Boolean =
            oldItem.id == newItem.id

        override fun areContentsTheSame(oldItem: NotificationItem, newItem: NotificationItem): Boolean =
            oldItem == newItem
    }
}