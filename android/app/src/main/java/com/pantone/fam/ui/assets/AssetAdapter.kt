package com.pantone.fam.ui.assets

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.pantone.fam.R
import com.pantone.fam.data.model.Asset
import com.pantone.fam.databinding.ItemAssetBinding

class AssetAdapter(
    private val onAssetClick: (Asset) -> Unit
) : ListAdapter<Asset, AssetAdapter.AssetViewHolder>(DiffCallback) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AssetViewHolder {
        val binding = ItemAssetBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return AssetViewHolder(binding, onAssetClick)
    }

    override fun onBindViewHolder(holder: AssetViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class AssetViewHolder(
        private val binding: ItemAssetBinding,
        private val onAssetClick: (Asset) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(asset: Asset) {
            binding.tvAssetTag.text = asset.assetTag
            binding.tvAssetName.text = asset.name
            binding.tvCategory.text = asset.categoryName ?: "General"
            binding.tvDepartment.text = asset.departmentName ?: "Unassigned"

            binding.tvStatusBadge.text = asset.status.replace("_", " ")

            val context = binding.root.context
            when (asset.status) {
                "IN_SERVICE", "AVAILABLE" -> {
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(context, R.color.status_green_text))
                }
                "UNDER_MAINTENANCE", "MAINTENANCE" -> {
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(context, R.color.status_amber_text))
                }
                "RETIRED", "DISPOSED", "LOST" -> {
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(context, R.color.status_red_text))
                }
                else -> {
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(context, R.color.status_blue_text))
                }
            }

            binding.root.setOnClickListener {
                onAssetClick(asset)
            }
        }
    }

    companion object DiffCallback : DiffUtil.ItemCallback<Asset>() {
        override fun areItemsTheSame(oldItem: Asset, newItem: Asset): Boolean =
            oldItem.id == newItem.id

        override fun areContentsTheSame(oldItem: Asset, newItem: Asset): Boolean =
            oldItem == newItem
    }
}