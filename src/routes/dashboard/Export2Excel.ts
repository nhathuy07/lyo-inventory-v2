
import { calculate_restock_data, type OrderRecordV2, type ProductV2, type TransferRecord } from "./DataPipelineV2";
import { imageToArrayBuffer } from "./imageToByteArray";
import { lazyLoadScript } from "./lazyLoadScript";
import { type Location } from "./Template";

export async function export_all_to_xlsx(order_records: OrderRecordV2[], transfer_records: TransferRecord[], variant_by_id: Map<number, ProductV2>, c_location_id: number, location: Location) {
    _actual_export_handler(calculate_restock_data(
        [...order_records, ...transfer_records],
        variant_by_id,
        c_location_id,
    ), location );
}

export async function export_selected_to_xlsx(selected_skus: Set<string>, datasource: ProductV2[], location: Location) {
    if (selected_skus.size > 0) {
        const x = datasource.filter((x) => { return selected_skus.has(x.sku) })
        _actual_export_handler(x, location)
    } else {
        // const x = datasource
        _actual_export_handler(datasource, location)
    }
}

export async function export_transfer_sheet_to_xlsx(order_records: OrderRecordV2[], transfer_records: TransferRecord[], variant_by_id: Map<number, ProductV2>, locations: Location[]) {
    const x = calculate_restock_data(
        [...order_records, ...transfer_records],
        variant_by_id,
        locations[0].id,
    ).filter((x) => {
        return x.c_on_hand > 0
    })

    _actual_export_handler(x, locations[0])

}

export async function _actual_export_handler(v: ProductV2[], location: Location) {

    // Get ExcelJS from CDN
    await lazyLoadScript("https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js", "sha512-dlPw+ytv/6JyepmelABrgeYgHI0O+frEwgfnPdXDTOIZz+eDgfW07QXG02/O8COfivBdGNINy+Vex+lYmJ5rxw==")
    await lazyLoadScript("https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.0/FileSaver.min.js", "sha512-csNcFYJniKjJxRWRV1R7fvnXrycHP6qDR21mgz1ZP55xY5d+aHLfo9/FcGDQLfn2IfngbAHd8LdfsagcCqgTcQ==")
    // Fetch the template
    const url = "https://lyo-inventory-mgmt.github.io/assets/sapo_mau_file_nhap_don_nhap_hang-1.xlsx"
    const resp = await fetch(url)

    if (!resp.ok) {
        alert("Gặp lỗi khi lấy tệp Excel mẫu: " + resp.statusText)
        return
    }

    const arrayBuffer = await resp.arrayBuffer();

    // Load workbook
    // @ts-ignore
    const wb = new ExcelJS.Workbook();
    wb.xlsx.load(arrayBuffer);
    const ws = wb.getWorksheet('Sheet1');

    let row = 8
    const img_col = 'C'

    v.forEach(async (v) => {
        // Add textual data
        const img_index = 2
        const rowdata = [v.sku, v.barcode, "", v.c_restock_third, v.c_restock_half, v.c_restock, v.c_on_hand, v.c_incoming, v.name]
        for (let c = 0; c < rowdata.length; c++) {
            ws.getCell(String.fromCharCode(65 + c) + row).value = rowdata[c]
        }
        row += 1

        // Load image
        const im = await imageToArrayBuffer(v.image_path, 139 )
        let ext  = v.image_path.split(".").at(-1)
        if (ext == 'jpg') {
            ext = 'jpeg'
        }
        if (im && im.b) {
            const img_id = wb.addImage({
                buffer: im.b,
                extension: ext
            })
            ws.addImage(img_id, `${img_col}${row}`)
            ws.getRow(row).height = im.h * 0.75
        }

    })

    // Save to XLSX

    const wb_buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([wb_buffer], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})
    
    // TODO: Move database to the deployment account

    const normalized_branch = ""
    // @ts-ignore
    saveAs(blob, 'download.xlsx')


}