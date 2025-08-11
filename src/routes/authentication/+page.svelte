


<script>
    // @ts-ignore
    import { Willow, Text, Button, Field } from "wx-svelte-core";
    import { Axios, HttpStatusCode } from "axios";
    import { goto, invalidateAll } from "$app/navigation";
    import { onMount } from "svelte";

    let authUrl = ""
    if (import.meta.env.MODE === "development") {
        authUrl = "http://localhost:8080/auth"
    } else {
        authUrl = "https://ninee35ef3e539b-inventory-mgmt-proxy.onrender.com/auth";
    }
    let a = new Axios();

    let username = $state("");
    let password = $state("");



    onMount(async () => {
        // TODO: Receive session key from other active tabs if any

        if (sessionStorage.getItem("token") != null) {
            await goto("dashboard", {invalidateAll: false})
        }

    })

    async function auth() {

        console.log(username, password)

        let r = await a.post(authUrl, JSON.stringify({
            username: username,
            password: password,
        }));

        if (r.status == 200) {
            let j = JSON.parse(r.data);
            sessionStorage.setItem("token", j.token);
            sessionStorage.setItem("isadmin", j.isadmin.toString());
            sessionStorage.setItem("username", username)
            // Go to dashboard page
            await goto("dashboard", {invalidateAll: false});
        } else if (r.status == HttpStatusCode.Unauthorized) {
            alert("Mật khẩu hoặc Username không chính xác");
        } else {
            alert(r.statusText);
        }
    }
</script>

<Willow fonts={false}>
    <div class="outer">
        <div class="inner">
            <h1>Đăng nhập</h1>
            <form>
                <Field label="Username">
                    <Text
                        bind:value={username}
                        autocomplete="username"
                        type="text"
                        placeholder="Nhập Username"
                    ></Text>
                </Field>
                <Field label="Password">
                    <Text
                        bind:value={password}
                        autocomplete="current-password"
                        type="password"
                        placeholder="Nhập Password"
                    ></Text>
                </Field>
            </form>

            <div style="padding-top: 10px;">
                <Button onclick={auth} type="primary block">Đăng nhập</Button>
            </div>
        </div>
    </div>


    <style>
    /* Switch accent color */
    .wx-willow-theme {
        --wx-color-primary: #0520c3;
    }
    .outer {
        width: 100%;
        height: 100dvh;
        align-content: center;
        justify-items: center;
        background-color: rgba(246, 246, 246, 0.741);
    }

    .inner {
        padding: 40px;
        background-color: white;
        border: 1px solid rgb(234, 234, 234);

        width: 400px;
    }
</style>

</Willow>



