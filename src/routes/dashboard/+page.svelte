<script>
    import DataPipelineV2 from "./DataPipelineV2.svelte";
    import ItemView from "./ItemView.svelte";

    let k = $state(0)
    function softReload() {
        k+=1
    }

</script>
{#key k}
<DataPipelineV2/>

{/key}