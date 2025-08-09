<script lang="ts">
    // @ts-ignore
    import { Modal, Field } from "wx-svelte-core"
    // @ts-ignore
    import { Grid } from "wx-svelte-grid"
    import ImageCell from "./ImageCell.svelte";
    import { onMount } from "svelte";

    let {shown = $bindable()} = $props()

    const columns =  [
        {
            id: "id",
            hidden: true
        }, {
            id: "sku",
            header: "SKU",
            resize: true,
            width: 100
        }, {
            id: "name",
            header: "Tên sản phẩm",
            width: 250,
            resize: true
        }, {
            id: "image_path",
            hidden: true,
        }, {
            id: "image",
            header: "Ảnh",
            cell: ImageCell,
            width: 150
        }, {
            id: "c_on_hand",
            header: "Tồn kho",
            width: 150
        }
    ]
    // @ts-ignore
    let api

    function handleResize() {
        // @ts-ignore
            api.exec("resize-column", {
                id: "name",
                width: innerWidth - 100 - 150 - 150
            })
    }

    onMount(() => {
        handleResize()
        window.onresize = () => {
            // @ts-ignore
            handleResize()
        }
    })

</script>

<div style="margin: 10px">
<Modal buttons={["ok"]} onconfirm={() => {shown = false}}>
    <div style="text-align: left">
        <Field width="100dvw">
            <h2>Danh sách kiểm hàng</h2>
            <Grid bind:this={api} {columns} autoRowHeight width="100%">

            </Grid>
        </Field>

    </div>
    
</Modal>
</div>
