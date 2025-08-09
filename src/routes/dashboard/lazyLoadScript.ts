export function lazyLoadScript(url: string, sha: string): Promise<void> {
	return new Promise((resolve, reject) => {
		// Prevent duplicate script loading
		if (document.querySelector(`script[src="${url}"]`)) {
			return resolve()
		}
		const script = document.createElement("script")
		script.async = true
		script.src = url
		script.crossOrigin = "anonymous"
		script.integrity = sha
		script.onload = () => resolve()
		script.onerror = () => reject(new Error(`Failed to load script: ${url}`))
		document.head.appendChild(script)
	})
}

export function lazyLoadStylesheets(url: string) {
	return new Promise<void>((resolve, reject) => {
		if (document.querySelector(`link[rel="stylesheet"][href="${url}"]`)) {
			return resolve()
		}
		const link = document.createElement("link")
		link.rel = "stylesheet"
		link.href = url
		link.onload = () => resolve()
		link.onerror = () => reject(new Error(`Failed to load stylesheet: ${url}`))
		document.head.appendChild(link)
	})
}