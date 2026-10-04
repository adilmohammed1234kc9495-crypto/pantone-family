package com.pantone.fam.ui.tasks

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.pantone.fam.R
import com.pantone.fam.data.model.Requisition
import com.pantone.fam.databinding.ItemTaskBinding

class TasksAdapter(
    private val onApprove: (Requisition) -> Unit,
    private val onReject: (Requisition) -> Unit
) : ListAdapter<Requisition, TasksAdapter.TaskViewHolder>(DiffCallback) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TaskViewHolder {
        val binding = ItemTaskBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return TaskViewHolder(binding, onApprove, onReject)
    }

    override fun onBindViewHolder(holder: TaskViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class TaskViewHolder(
        private val binding: ItemTaskBinding,
        private val onApprove: (Requisition) -> Unit,
        private val onReject: (Requisition) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(req: Requisition) {
            binding.tvTaskType.text = "REQUISITION APPROVAL"
            binding.tvTaskStatus.text = req.status
            binding.tvTaskTitle.text = req.requestNumber ?: "Requisition #${req.id.take(8)}"
            binding.tvTaskDetail.text = "${req.justification ?: "Procurement request"} • Priority: ${req.priority}"

            val context = binding.root.context
            when (req.status) {
                "SUBMITTED", "PENDING_APPROVAL", "PENDING" -> {
                    binding.tvTaskStatus.setTextColor(ContextCompat.getColor(context, R.color.status_amber_text))
                    binding.layoutTaskActions.visibility = android.view.View.VISIBLE
                }
                "APPROVED" -> {
                    binding.tvTaskStatus.setTextColor(ContextCompat.getColor(context, R.color.status_green_text))
                    binding.layoutTaskActions.visibility = android.view.View.GONE
                }
                else -> {
                    binding.tvTaskStatus.setTextColor(ContextCompat.getColor(context, R.color.status_red_text))
                    binding.layoutTaskActions.visibility = android.view.View.GONE
                }
            }

            binding.btnApprove.setOnClickListener {
                onApprove(req)
            }

            binding.btnReject.setOnClickListener {
                onReject(req)
            }
        }
    }

    companion object DiffCallback : DiffUtil.ItemCallback<Requisition>() {
        override fun areItemsTheSame(oldItem: Requisition, newItem: Requisition): Boolean =
            oldItem.id == newItem.id

        override fun areContentsTheSame(oldItem: Requisition, newItem: Requisition): Boolean =
            oldItem == newItem
    }
}