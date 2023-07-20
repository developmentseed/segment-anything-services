<template>
<div class='page'>
    <header class='navbar navbar-expand-md d-print-none' data-bs-theme="dark">
        <div class="container-xl">
            <div class="col-auto">
                <img @click='$router.push("/")' class='cursor-pointer' height='50' width='50' src='/logo.png'>
            </div>
            <div class="col mx-2">
                <div class="page-pretitle">Development Seed</div>
                <h2 class="page-title">Segment Anything Service</h2>
            </div>

            <div v-if='user' class='ms-auto'>
                <div class='btn-list'>
                    <div class='dropdown'>
                        <div type="button" id="userProfileButton" data-bs-toggle="dropdown" aria-expanded="false" class='btn btn-dark'>
                            <UserIcon/>
                            </div>
                                <ul class="dropdown-menu" aria-labelledby='userProfileButton'>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <UserIcon class='my-2'/><a @click='$router.push("/profile")' class="cursor-pointer dropdown-item">Profile</a>
                                    </div>
                                    <div class='d-flex mx-2 cursor-pointer'>
                                        <LogoutIcon class='my-2'/><a @click='logout' class="curdor-pointer dropdown-item">Logout</a>
                                    </div>
                                </ul>
                            </div>
                        <div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <router-view/>

    <TablerError v-if='err' :err='err' @close='err = null'/>
</div>
</template>

<script>
import '@tabler/core/dist/js/tabler.min.js';
import '@tabler/core/dist/css/tabler.min.css';
import {
    HomeIcon,
    LogoutIcon,
    UserIcon,
    AdjustmentsIcon,
} from 'vue-tabler-icons';
import {
    TablerError
} from '@tak-ps/vue-tabler';

export default {
    name: 'SegmentAnything',
    data: function() {
        return {
            mounted: false,
            user: null,
            err: null,
            status: null,
        }
    },
    errorCaptured: function(err) {
        this.err = err;
    },
    watch: {
        async $route() {
            if (!this.mounted) return;
            if (localStorage.token) {
                await this.getLogin();
                return;
            }
            if (this.$route.name !== 'login') this.$router.push("/login");
        }
    },
    mounted: async function() {
        const url = window.stdurl('/api');

        if (localStorage.token) {
            await this.getLogin();
        } else if (this.$route.name !== 'login') {
            this.$router.push("/login");
        }

        this.mounted = true;
    },
    methods: {
        logout: function() {
            this.user = null;
            delete localStorage.token;
            this.$router.push("/login");
        },
        getLogin: async function() {
            try {
                this.user = await window.std('/login');
            } catch (err) {
                this.user = null;
                delete localStorage.token;
                if (this.$route.name !== 'login') this.$router.push("/login");
            }
        },
    },
    components: {
        HomeIcon,
        LogoutIcon,
        UserIcon,
        TablerError,
        AdjustmentsIcon,
    }
}
</script>
