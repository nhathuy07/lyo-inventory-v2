import { toast } from '@zerodevx/svelte-toast'

export const toast_success = m => toast.push(m, {
  theme: {

    '--toastBarBackground': 'white'
  }
})

export const toast_warning = m => toast.push(m, { theme: { 
    '--toastBarBackground': '#FFDF00'
 } })

export const toast_failure = m => toast.push(m, { theme: { 
    '--toastBarBackground': '#FE6158',
    '--toastColor': 'white',
    // '--toastBackground': '#FE6158',
 } })