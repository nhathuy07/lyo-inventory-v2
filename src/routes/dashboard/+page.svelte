<script>
    import { goto } from "$app/navigation";
    import ItemViewV2 from "./ItemViewV2.svelte";

    let k = $state(0)
    function softReload() {
        k+=1
    }

    // Broadcast channel

    const bc = new BroadcastChannel("key_broadcast")
    const revoke_broadcast_channel = new BroadcastChannel("revoke")

    revoke_broadcast_channel.onmessage = (event) => {
        if (event.data == "revoke") {
            sessionStorage.clear();
            goto("/authentication")
        }
    }

    // bc.postMessage({op: "request"})
    bc.onmessage = (event) => {
        if (!sessionStorage.getItem("token")) {
            return false
        }

        if (event.data.op == "request" && sessionStorage.getItem("token")) {
            console.log("posted the key "+ sessionStorage.getItem("token"))
        bc.postMessage({
            op: "key",
            //             sessionStorage.setItem("token", event.data.token);
            // sessionStorage.setItem("isadmin", event.data.isadmin.toString());
            // sessionStorage.setItem("username", event.data.username);
            token: sessionStorage.getItem("token"),
            isadmin: sessionStorage.getItem("isadmin"),
            username: sessionStorage.getItem("username")

        })
        }

    }

</script>
{#key k}
    <ItemViewV2></ItemViewV2>
{/key}