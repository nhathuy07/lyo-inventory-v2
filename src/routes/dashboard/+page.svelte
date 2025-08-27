<script>
    import ItemViewV2 from "./ItemViewV2.svelte";

    let k = $state(0)
    function softReload() {
        k+=1
    }

</script>
{#key k}
    <ItemViewV2></ItemViewV2>
{/key}