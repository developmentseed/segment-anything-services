<template>
<div class="page page-center">
    <div class="container container-normal py-4">
        <div class="row align-items-center g-4">
            <div class="col-lg">
                <div class="container-tight">
                    <div class="card card-md">
                        <div class="card-body">
                            <div class='text-center' style='margin-bottom: 24px;'>
                                <img src='/logo.png' height='150'/>
                            </div>

                            <template v-if='!challenge'>
                                <h2 class="h2 text-center mb-4">Login to your account</h2>
                                <TablerLoading v-if='loading' desc='Logging in'/>
                                <template v-else>
                                    <div class="mb-3">
                                        <label class="form-label">Username or Email</label>
                                        <input v-model='username' v-on:keyup.enter='createLogin' type="text" class="form-control" placeholder="your@email.com" autocomplete="off">
                                    </div>
                                    <div class="mb-2">
                                        <label class="form-label">
                                            Password
                                        </label>
                                        <div class="input-group input-group-flat">
                                            <input v-model='password' v-on:keyup.enter='createLogin' type="password" class="form-control" placeholder="Your password" autocomplete="off">
                                        </div>
                                    </div>
                                    <div class="form-footer">
                                      <button @click='createLogin' type="submit" class="btn btn-primary w-100">Sign In</button>
                                    </div>
                                </template>
                            </template>
                            <template v-else>
                                <h2 class="h2 text-center mb-4">Reset Password</h2>
                                <TablerLoading v-if='loading' desc='Resetting Password'/>
                                <template v-else>
                                    <div class="mb-3">
                                        <label class="form-label">Password</label>
                                        <input v-model='password' v-on:keyup.enter='createReset' type="password" class="form-control" autocomplete="off">
                                    </div>
                                    <div class="form-footer">
                                      <button @click='createReset' type="submit" class="btn btn-primary w-100">Reset</button>
                                    </div>
                                </template>

                            </template>
                        </div>
                    </div>
                    <div class="text-center text-muted mt-3">
                        Don't have account yet? <a href='mailto:nicholas.ingalls@developmentseed.org'>Contact Us</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import {
    TablerLoading
} from '@tak-ps/vue-tabler'

export default {
    name: 'Login',
    data: function() {
        return {
            loading: false,
            username: '',
            password: '',
            challenge: null
        }
    },
    methods: {
        external: function(url) {
            window.location = new URL(url);
        },
        createReset: async function() {
            this.loading = true;
            try {
                const login = await window.std('/login', {
                    method: 'POST',
                    body: {
                        ChallengeName: this.challenge.ChallengeName,
                        ChallengeResponse: {
                            USERNAME: this.username,
                            NEW_PASSWORD: this.password
                        },
                        Session: this.challenge.Session
                    }
                });

                this.challenge = null;
            } catch (err) {
                this.loading = false;
                throw err;
            }

            this.loaing = false;
            await this.createLogin();
        },
        createLogin: async function() {
            this.loading = true;
            try {
                const login = await window.std('/login', {
                    method: 'POST',
                    body: {
                        Username: this.username,
                        Password: this.password
                    }
                });

                if (login.ChallengeName) {
                    this.challenge = login;
                    this.loading = false;
                    this.password = false;
                } else {
                    localStorage.token = login.token;
                    this.$emit('login');
                    this.$router.push("/");
                }
            } catch (err) {
                this.loading = false;
                throw err;
            }
        }
    },
    components: {
        TablerLoading
    }
}
</script>
