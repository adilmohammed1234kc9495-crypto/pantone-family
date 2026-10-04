package com.pantone.fam.ui.assets

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.pantone.fam.PantoneApplication
import com.pantone.fam.data.repository.AssetRepository
import com.pantone.fam.databinding.FragmentAssetsBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AssetListFragment : Fragment() {

    private var _binding: FragmentAssetsBinding? = null
    private val binding get() = _binding!!

    private lateinit var assetRepo: AssetRepository
    private lateinit var adapter: AssetAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAssetsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val app = requireActivity().application as PantoneApplication
        assetRepo = AssetRepository(app.apiClient.apiService)

        adapter = AssetAdapter { asset ->
            val intent = Intent(requireContext(), AssetDetailActivity::class.java).apply {
                putExtra(AssetDetailActivity.EXTRA_ASSET_ID, asset.id)
            }
            startActivity(intent)
        }

        binding.recyclerViewAssets.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerViewAssets.adapter = adapter

        binding.swipeRefresh.setOnRefreshListener {
            loadAssets(binding.etSearch.text?.toString()?.trim())
        }

        binding.etSearch.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                loadAssets(binding.etSearch.text?.toString()?.trim())
                true
            } else {
                false
            }
        }

        loadAssets()
    }

    private fun loadAssets(query: String? = null) {
        binding.swipeRefresh.isRefreshing = true

        viewLifecycleOwner.lifecycleScope.launch(Dispatchers.IO) {
            val result = assetRepo.getAssets(search = if (query.isNullOrBlank()) null else query)
            withContext(Dispatchers.Main) {
                if (_binding != null) {
                    binding.swipeRefresh.isRefreshing = false
                    result.onSuccess { assets ->
                        adapter.submitList(assets)
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