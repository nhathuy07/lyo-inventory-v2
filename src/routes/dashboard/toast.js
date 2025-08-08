import { toast } from '@zerodevx/svelte-toast'

export const success = m => toast.push(m, {
  theme: {

    '--toastBarBackground': 'olive'
  }
})

export const warning = m => toast.push(m, { theme: { 
    '--toastBarBackground': 'yellow'
 } })

export const failure = m => toast.push(m, { theme: { 
    '--toastBarBackground': 'red',
    '--toastColor': 'white',
    // '--toastBackground': '#FE6158',
 } })