<script lang="ts">
    // @ts-ignore
    import {Button} from "wx-svelte-core"
let {cell} = $props()
</script>

<div style="width: 100%; display: flex; flex-direction: row; align-items: center; justify-content: space-between ">
    <p>{cell.text}</p>
    <div style="max-height: 30px; display: flex">
    <Button icon="mdi mdi-sort" type="secondary" style="height: 30px;"></Button>

    </div>
</div>
