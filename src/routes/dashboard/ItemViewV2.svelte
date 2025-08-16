<script lang="ts">
    // @ts-ignore
    import { Grid, Willow } from "wx-svelte-grid"
    // @ts-ignore
    import { Button, Select, Portal, Modal } from "wx-svelte-core"
    // @ts-ignore
    import {Locale } from "wx-svelte-core"
    import { calculate_restock_data, get_active_products, get_locations, fetch_order_record, type ProductV2, type OrderRecordV2, type TransferRecord, fetch_inventory_transfer } from "./DataPipelineV2";
    import SelectionCheckboxCell from "./SelectionCheckboxCell.svelte";
    import ImageCell from "./ImageCell.svelte";
    import { vi } from "./Localization";
    import { onMount, setContext } from "svelte";
    import { type Location } from "./Template";
    import { applyAction } from "$app/forms";
    import { lazyLoadStylesheets } from "./lazyLoadScript";
    import LoadingThrobber from "./LoadingThrobber.svelte";
    import SettingsModal from "./SettingsModal.svelte";

    import { Axios } from "axios";
    import { goto } from "$app/navigation";
    import HeaderWithSortUi from "./HeaderWithSortUI.svelte";
    

    const columns = [
        {
            id: "id",
            hidden: true,
        },
        {
            id: "selected",
            cell: SelectionCheckboxCell,
            width: 36,
        },
        {
            id: "sku",
            resize: true,
            width: 130, // 90 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "SKU"
                }
            ]
        },
        {
            id: "name",
            resize: true,
            width: 240, // 200 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Tên sản phẩm"
                }
            ]
        },
        {
            id: "image",
            cell: ImageCell,
            sort: true,

        },
        {
            id: "image_path",
            hidden: true,
            sort: true,
        },
        {
            id: "c_restock_third",
            resize: true,
            width: 140, // 100 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "SL đặt\n(1/3 tháng)"
                }
            ]
        },
        {
            id: "c_restock_half",
            resize: true,
            width: 140, // 100 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "SL đặt\n(1/2 tháng)"
                }
            ]
        },
        {
            id: "c_restock",
            resize: true,
            width: 140, // 100 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "SL đặt\n(1 tháng)"
                }
            ]
        },
        {
            id: "suppliers",
            resize: true,
            width: 160, // Add width for consistency (if needed)
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "NCC"
                }
            ]
        },
        {
            id: "c_on_hand",
            resize: true,
            width: 140, // 100 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Tồn kho"
                }
            ]
        },
        {
            id: "c_incoming",
            resize: true,
            width: 140, // 100 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Đang về"
                }
            ]
        },
        {
            id: "brand",
            resize: true,
            width: 180, // 140 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Nhãn hiệu"
                }
            ]
        },
        {
            id: "unit",
            resize: true,
            width: 180, // 140 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Đơn vị tính"
                }
            ]
        },
        {
            id: "import_price",
            resize: true,
            width: 180, // 140 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Giá nhập"
                }
            ]
        },
        {
            id: "retail_price",
            resize: true,
            width: 180, // 140 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Thành tiền (Shop)"
                }
            ]
        },
        {
            id: "retail_price_ecomm",
            resize: true,
            width: 180, // 140 + 40
            header: [
                {
                    cell: HeaderWithSortUi,
                    text: "Thành tiền (TMĐT)"
                }
            ]
        },
    ];

    const responsive_fields = {
        800: {
            columns: [
                {
                    id: "id",
                    hidden: true,
                },
                {
                    id: "selected",
                    cell: SelectionCheckboxCell,
                    width: 36,
                },
                {
                    id: "sku",
                    resize: true,
                    width: 130, // 90 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "SKU"
                        }
                    ]
                },
                {
                    id: "name",
                    resize: true,
                    width: 240, // 200 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Tên sản phẩm"
                        }
                    ]
                },
                {
                    id: "image",
                    cell: ImageCell,
                    sort: true,

                },
                {
                    id: "image_path",
                    hidden: true,
                    sort: true,
                },
                {
                    id: "c_restock_third",
                    resize: true,
                    width: 140, // 100 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "SL đặt\n(1/3 tháng)"
                        }
                    ]
                },
                {
                    id: "c_restock_half",
                    resize: true,
                    width: 140, // 100 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "SL đặt\n(1/2 tháng)"
                        }
                    ]
                },
                {
                    id: "c_restock",
                    resize: true,
                    width: 140, // 100 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "SL đặt\n(1 tháng)"
                        }
                    ]
                },
                {
                    id: "suppliers",
                    resize: true,
                    width: 140, // Add width for consistency (if needed)
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "NCC"
                        }
                    ]
                },
                {
                    id: "c_on_hand",
                    resize: true,
                    width: 140, // 100 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Tồn kho"
                        }
                    ]
                },
                {
                    id: "c_incoming",
                    resize: true,
                    width: 140, // 100 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Đang về"
                        }
                    ]
                },
                {
                    id: "brand",
                    resize: true,
                    width: 180, // 140 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Nhãn hiệu"
                        }
                    ]
                },
                {
                    id: "unit",
                    resize: true,
                    width: 180, // 140 + 40
                    header: [
                        {
                            cell: HeaderWithSortUi,
                            text: "Đơn vị tính"
                        }
                    ]
                },
                {
                    id: "included_tax_import_price",
                    header: "Giá nhập",
                    resize: true,
                    width: 180, // 140 + 40
                },
                {
                    id: "included_tax_price",
                    header: "Thành tiền (Shop)",
                    resize: true,
                    width: 180, // 140 + 40
                },
                {
                    id: "included_tax_price_ecomm",
                    header: "Thành tiền (TMĐT)",
                    resize: true,
                    width: 180, // 140 + 40
                },
            ],
            
        },
    };

    let data: ProductV2[] = $state([])
    let is_loading = $state(false)
    let is_settings_open = $state(false)
    
    let datasource: ProductV2[] = []
    let variant_by_id = new Map<number, ProductV2>()
    let order_records: OrderRecordV2[] = []
    let transfer_records: TransferRecord[] = []
    let locations: Location[] = $state([])
    
    let c_location_id: number = $state(-1)
    let rowCount = $state(0)
    let grid_key = $state(0)

    let selected_skus = $state(new Set<string>())
    let checkbox_update_key = $state({k: 0})
    setContext("selected_skus", selected_skus)
    setContext("checkbox_key", checkbox_update_key)
    let proxyUrl =""
    let baseUrl =""

    if (import.meta.env.MODE === "development") {
    proxyUrl = "http://localhost:8080/api";
    baseUrl = "http://localhost:8080";
} else {
    proxyUrl =
        "https://ninee35ef3e539b-inventory-mgmt-proxy.onrender.com/api";
    baseUrl = "https://ninee35ef3e539b-inventory-mgmt-proxy.onrender.com";
}

export function obtain_access_token() {
    if (sessionStorage.getItem("token") == null) {
        goto("/authentication")
    }
    return "Bearer " + sessionStorage.getItem("token");
}
 
    let a = new Axios({
        headers: {
            "Content-Type": "application/json",
            Authorization: obtain_access_token(),
        },
    });


    async function dataProvider(ev: any) {
        const {row} = ev;
        if (row) {
            data = datasource.slice(row.start, row.end)
        }
    }

    let grid_api = $state()

    

    async function logout() {
        await a.delete(`${baseUrl}/revoke`);
        sessionStorage.clear();
        goto("/authentication");
    }

    function tweak_ui() {

    }

    function handle_location_update() {

        is_loading = true

        datasource = calculate_restock_data([...order_records, ...transfer_records], variant_by_id, c_location_id)
        rowCount = datasource.length
        grid_key++

        is_loading = false
    }

    async function initialize() {
        
        is_loading = true

        locations = await get_locations()
        variant_by_id = await get_active_products()
        order_records = await fetch_order_record(variant_by_id)
        transfer_records = await fetch_inventory_transfer(variant_by_id,)
        datasource = calculate_restock_data([...order_records, ...transfer_records], variant_by_id, locations[0].id)
        rowCount = datasource.length
        c_location_id = locations[0].id
        console.log(datasource)
        grid_key++

        is_loading = false
        
    }

    onMount(async () => {
        lazyLoadStylesheets("https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css")
        await initialize()
        tweak_ui()
    
    })

</script>

<Locale words={vi}>
<Willow>
    <div style="display: flex; gap: 10px; padding-bottom: 10px">
        <Button onclick={initialize} icon="mdi mdi-refresh">Làm mới</Button>
        <div style="width: 200px">
            <Select bind:value={c_location_id} options={locations} onchange={handle_location_update} width=200 placeholder="Chọn kho hàng..."></Select>
        </div>
        <div>
            <Button icon="mdi mdi-download">Xuất Excel</Button>
            <Button icon="mdi mdi-package-variant-closed-check">Kiểm hàng</Button>
            <Button icon="mdi mdi-cog" onclick={() => { is_settings_open = true }}></Button>
            <Button icon="mdi mdi-logout" onclick={logout} type="danger"></Button>

        </div>
    </div>
    <div style="height: calc(100dvh - 10px);">
        {#key grid_key}
        <Grid bind:this={grid_api} {columns} {data} responsive={responsive_fields} onrequestdata={dataProvider} dynamic={{rowCount}} sizes={{ rowHeight: 165 }} />
        {/key}
    </div>

    {#if is_loading}
                <Portal>
                    <Modal buttons={[]}>
                        <div
                            style="display:flex; flex-direction:column; align-items: center;"
                        >
                            <LoadingThrobber></LoadingThrobber>
                            <p style="margin-bottom: 0px;">Đang tải...</p>
                        </div>
                    </Modal>
                </Portal>
    {/if}
    
    {#if is_settings_open}
    <Portal>
        <SettingsModal bind:shown={is_settings_open}></SettingsModal>
    </Portal>
    {/if}

</Willow>
</Locale>

