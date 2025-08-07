<script lang="ts">
    import { getContext, onMount } from "svelte";

    // @ts-expect-error
	import { Checkbox } from "wx-svelte-core";

	let { row, api } = $props();

	let selected_skus: Set<string> = getContext("selected_skus")
	let key: any = getContext("checkbox_key")
	let checked = $state(selected_skus.has(row.sku))
	
	$effect(() => {
		console.log(key.k)
		checked = selected_skus.has(row.sku)
		
	})

	function onChange(ev: any) {
		const { value } = ev;

		if (value == true) {
			selected_skus.add(row.sku)
		} else {
			selected_skus.delete(row.sku)
		}

		api.exec("select-row", {
			id: row.id,
			mode: value,
			toggle: true,
		});
	}
</script>
{#key key.k}
<div>
	<Checkbox value={checked} class="table_checkbox" onchange={onChange} />
</div>

{/key}