import { Axios } from "axios"

let a = new Axios()
let canvas = document.createElement("canvas")

interface ImageInfo {
    b: ArrayBuffer | undefined,
    w: number,
    h: number
}

export async function imageToArrayBuffer(src: string, width: number = 140) {

    let image: HTMLImageElement = document.createElement("img")
    const ctx = canvas.getContext("2d")

    // Fetch image from the web
    const res = await a.get(src, {
        responseType: "blob"
    })

    if (res.status == 200) {

        return new Promise<ImageInfo>((resolve, reject) => {
            image.src = URL.createObjectURL(res.data)
            image.onload = () => {
                // console.log("original", image.width, image.height)
                
                image.height = image.height / image.width * width
                image.width = width
                canvas.width = image.width
                canvas.height = image.height
                // console.log("changed", image.width, image.height)
                

                ctx?.clearRect(0, 0, canvas.width, canvas.height)
                ctx?.drawImage(image, 0, 0, canvas.width, canvas.height)
                canvas.toBlob(async (blob) => {
                    URL.revokeObjectURL(image.src)
                    // document.removeChild(image)
                    // @ts-ignore
                    image =undefined
                    resolve({
                        b: await blob?.arrayBuffer(),
                        w: canvas.width,
                        h: canvas.height
                    })
                })
            }
        })


    } else {
        return null
    }



}