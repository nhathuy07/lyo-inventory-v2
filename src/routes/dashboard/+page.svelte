<script>
    import ItemView from "./ItemView.svelte";

    let k = $state(0)
    function softReload() {
        k+=1
    }

</script>
{#key k}

{/key}