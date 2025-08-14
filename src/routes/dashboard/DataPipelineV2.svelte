<script lang="ts">
    import { Axios } from "axios"; 
    import { onMount } from "svelte";
    import  {type Location} from "./Template";

    let proxyUrl: string
    let baseUrl: string
    
    interface OrderRecordV2 {
        sku: string
        t_unix: number
        quantity: number
        location_id: string
        is_composite: boolean
        new_record: boolean
        order_id: number
    }

    if (import.meta.env.MODE === "development") {
        proxyUrl = "http://localhost:8080/api";
        baseUrl = "http://localhost:8080";
    } else {
        proxyUrl =
            "https://ninee35ef3e539b-inventory-mgmt-proxy.onrender.com/api";
        baseUrl = "https://ninee35ef3e539b-inventory-mgmt-proxy.onrender.com";
    }

    function obtain_access_token() {
        return "Bearer " + sessionStorage.getItem("token");
    }


    let a = new Axios({
        headers: {
            "Content-Type": "application/json",
            Authorization: obtain_access_token(),
        },
    });

    async function get_locations(): Promise<Location[]> {
        let resp = await a.get(`${proxyUrl}/admin/locations.json`);
        // let location_by_id: Map<number, string> = new Map()
        let location_by_id: Location[] = [];
        if (resp.status != 200) {
            return location_by_id;
        } else {
            let locs = JSON.parse(resp.data).locations;
            locs.forEach((loc: any) => {
                let addrs: string[] = [
                    loc.address1,
                    loc.address2,
                    loc.district,
                    loc.city,
                    loc.country,
                ];
                addrs = addrs.filter((v, _, __) => {
                    return v != "" && v != null;
                });
                location_by_id.push({
                    id: loc.id,
                    address: addrs.join(", "),
                    label: loc.label,
                });
            });
        }

        return location_by_id;
    }

    function isFirstTime() {
        return localStorage.getItem("last_data_update") == null
    }

    function setLastDataUpdate() {
        localStorage.setItem("last_data_update", (new Date()).getTime().toString())
    }

    function getLastDataUpdate() {
        const t_unix = localStorage.getItem("last_data_update");
        let utcString;
        if (t_unix != null) {
            utcString = new Date(Number(t_unix)).toISOString();
        } else {
            const now = new Date();
            now.setMonth(now.getMonth() - 6);
            utcString = now.toISOString();
        }
        // Strip milliseconds if present (UTC string from Date does not include ms, but just in case)
        return utcString.replace(/\.\d{3}Z$/, "Z");
    }   

    function sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function fetchRecordsFromIndexedDB(): Promise<OrderRecordV2[]> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("LYOInventoryDB", 3);

            request.onerror = function () {
                reject("IndexedDB connection failed");
            };

            request.onsuccess = function () {
                const db = request.result;
                const tx = db.transaction("OrderRecordsV2", "readonly");
                const store = tx.objectStore("OrderRecordsV2");
                const records: OrderRecordV2[] = [];
                const cursorRequest = store.openCursor();

                cursorRequest.onerror = function () {
                    db.close();
                    reject("Cursor error");
                };

                cursorRequest.onsuccess = function (event) {
                    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                    if (cursor) {
                        const value = cursor.value;
                        records.push({
                            sku: value.sku,
                            t_unix: value.t_unix,
                            quantity: value.quantity,
                            location_id: value.location_id,
                            is_composite: value.is_composite,
                            new_record: false,
                            order_id: value.order_id
                        });
                        cursor.continue();
                    } else {
                        db.close();
                        resolve(records);
                    }
                };
            };
        });
    }

    async function updateIndexedDB(records: OrderRecordV2[]) {
        return new Promise<void>((resolve, reject) => {
            const request = indexedDB.open("LYOInventoryDB", 3);

            request.onupgradeneeded = function (event) {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains("OrderRecordsV2")) {
                    const store = db.createObjectStore("OrderRecordsV2", {autoIncrement: true});
                    store.createIndex("t_unix", "t_unix");
                }
            };

            request.onerror = function () {
                reject("IndexedDB connection failed");
            };

            request.onsuccess = function () {
                const db = request.result;
                const tx = db.transaction("OrderRecordsV2", "readwrite");
                const store = tx.objectStore("OrderRecordsV2");

                records
                    .filter(r => r.new_record)
                    .forEach(r => {
                        store.put({
                            t_unix: r.t_unix,
                            quantity: r.quantity,
                            sku: r.sku,
                            location_id: r.location_id,
                            is_composite: r.is_composite,
                            order_id: r.order_id
                        });
                    });

                tx.oncomplete = function () {
                    db.close();
                    resolve();
                };

                tx.onerror = function () {
                    db.close();
                    reject("Transaction failed");
                };
            };
        });
    }

    async function fetchOrderRecord() {

        const last_update_utc = getLastDataUpdate()
        // const today_utc = new Date().toUTCString()
        let existing_order_ids = new Set<number>();
        let page = 1
        let order_records: OrderRecordV2[] = [];
        let total_pages = Infinity
        
        // TODO: Fetch old records from IndexedDB
        if (!isFirstTime()) {
            order_records = await fetchRecordsFromIndexedDB()
        }
        for (let r of order_records) {
            existing_order_ids.add(r.order_id)
        }

        let running = true

        while (running) {
            const resp = await Promise.all(
                [
                    a.get(`${proxyUrl}/admin/orders.json`, {params: {"status": "completed", "page": page, "limit": 250, "modified_on_min": last_update_utc}}),
                    a.get(`${proxyUrl}/admin/orders.json`, {params: {"status":"completed", "page": page+1, "limit": 250, "modified_on_min": last_update_utc}}),
                    a.get(`${proxyUrl}/admin/orders.json`, {params: {"status": "completed", "page": page+2, "limit": 250, "modified_on_min": last_update_utc}}),
                    a.get(`${proxyUrl}/admin/orders.json`, {params: {"status":"completed", "page": page+3, "limit": 250, "modified_on_min": last_update_utc}}),
                ]
            )

            const success = (resp[0].status == 200) && (resp[1].status == 200)  && (resp[2].status == 200)  && (resp[3].status == 200)
            
            if (success) {
                total_pages = JSON.parse(resp[0].data).metadata.total

                for (let r of resp) {
                    const j = JSON.parse(r.data)
                    if (j.orders.length == 0) {
                        running = false
                        break 
                    }
                    if (j.orders) {

                        j.orders.forEach((order: any) => {
                            if ( ! existing_order_ids.has(order.id)) {
                                order.fulfillments.forEach((fulfillment: any) => {
                                    fulfillment.fulfillment_line_items.forEach((line_item: any) => {
                                        
                                        order_records.push({order_id:order.id, quantity: line_item.quantity, sku: line_item.sku, is_composite: line_item.is_composite, location_id: fulfillment.stock_location_id, t_unix: (new Date(order.modified_on)).getTime(), new_record: true})
                                    });
                                })
                                existing_order_ids.add(order.id)
                            }                            
                        })
                    }
                }  
                page += 4
            } else {
                await sleep(1000)
            }
        }

        // Update IndexedDB
        updateIndexedDB(order_records.filter((v) => v.new_record))

        return order_records

    }

    async function fetchInventoryTransfer(location_id: number) {

    }

    onMount(async () => {
        let locs = await get_locations()
        let x = await fetchOrderRecord()
        let y = await fetchInventoryTransfer(locs[0].id)

        setLastDataUpdate()

    })
</script>

<h1>a</h1>