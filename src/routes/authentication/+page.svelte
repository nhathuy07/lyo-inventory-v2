<script>
    // @ts-ignore
    import { Willow, Text, Button, Field } from "wx-svelte-core";
    import { Axios, HttpStatusCode } from "axios";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { lazyLoadStylesheets } from "../dashboard/lazyLoadScript";

    let authUrl = "";
    let checkOnlyUrl = "";
    if (import.meta.env.MODE === "development") {
        authUrl = "http://localhost:8080/auth";
        checkOnlyUrl = "http://localhost:8080/check_only";
    } else {
        authUrl =
            "https://ninee35ef3e539b-inventory-mgmt-proxy.onrender.com/auth";
        checkOnlyUrl =
            "https://ninee35ef3e539b-inventory-mgmt-proxy.onrender.com/check_only";
    }
    let a = new Axios();

    a.interceptors.response.use(
        (response) => {
            // This function handles successful responses (e.g., status 2xx)
            return response;
        },
        (error) => {
            // This function handles error responses (e.g., status 4xx, 5xx)

            // You can access details of the error here, such as:
            // error.response.status: HTTP status code (e.g., 404, 500)
            // error.response.data: Error message or data from the server
            // error.message: Network error message if no response from server

            // Example: Handle specific error codes
            if (error.response && error.response.status === 401) {
                console.error("Unauthorized access:", error.response.data);
            } else if (error.response && error.response.status === 500) {
                console.error("Server error:", error.response.data);
                alert("Không thể kết nối với server");
            } else {
                // Handle other types of errors (e.g., network errors)
                console.error("An error occurred:", error.message);
                alert("Không thể kết nối với server");
            }

            // Important: Re-throw the error to propagate it to the .catch() block
            // of the original request, allowing for specific error handling there as well.
            return Promise.reject(error);
        },
    );

    let username = $state("");
    let password = $state("");

    onMount(async () => {
        // TODO: Receive session key from other active tabs if any
        lazyLoadStylesheets(
            "https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css",
        );

        if (sessionStorage.getItem("token") != null) {
            await goto("dashboard", { invalidateAll: false });
        }
    });

    let password_shown = $state(false);

    async function auth() {
        password_shown = false;
        console.log(username, password);

        let r = await a.post(
            authUrl,
            JSON.stringify({
                username: username,
                password: password,
            }),
        );

        if (r.status == 200) {
            let j = JSON.parse(r.data);
            sessionStorage.setItem("token", j.token);
            sessionStorage.setItem("isadmin", j.isadmin.toString());
            sessionStorage.setItem("username", username);
            // Go to dashboard page
            console.log("logged in manually", sessionStorage.getItem("token"))
            await goto("dashboard", { invalidateAll: false });
        } else if (r.status == HttpStatusCode.Unauthorized) {
            alert("Mật khẩu hoặc Username không chính xác");
        } else {
            alert(r.statusText);
        }
    }

    // Broadcast channel

    const bc = new BroadcastChannel("key_broadcast")
    bc.postMessage({op: "request"})
    bc.onmessage = async (event) => {

        if (event.data.op == "key") {
        console.log("received the key "+ event.data.token)

        if (sessionStorage.getItem("token")) {
            return
        }

        let r = await a.get(
            checkOnlyUrl,
            {
                headers: {
                    Authorization: `Bearer ${event.data.token}`
                }
            }
        );

        if (r.status != 200) {
            return
        }

        console.log("valid key "+ event.data.token)


            sessionStorage.setItem("token", event.data.token);
            sessionStorage.setItem("isadmin", event.data.isadmin.toString());
            sessionStorage.setItem("username", event.data.username);
            console.log("logged in via key broadcasting")


            await goto("dashboard", { invalidateAll: false });

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
                    {#if !password_shown}
                        <div style="display: flex; gap: 10px">
                            <Text
                                bind:value={password}
                                autocomplete="current-password"
                                type="password"
                                placeholder="Nhập Password"
                            ></Text>
                            <div style="width: 32px;">
                                <Button
                                    icon="mdi mdi-eye"
                                    type="secondary"
                                    onclick={() => {
                                        password_shown = !password_shown;
                                    }}
                                ></Button>
                            </div>
                        </div>
                    {:else}
                        <div style="display: flex; gap: 10px">
                            <Text
                                bind:value={password}
                                autocomplete="current-password"
                                type="text"
                                placeholder="Nhập Password"
                            ></Text>
                            <div style="width: 32px;">
                                <Button
                                    icon="mdi mdi-eye-off"
                                    type="secondary"
                                    onclick={() => {
                                        password_shown = !password_shown;
                                    }}
                                ></Button>
                            </div>
                        </div>
                    {/if}
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
