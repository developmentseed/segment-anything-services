<template>
<div>
    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class='card'>
                    <div class='card-header d-flex'>
                        <h1 class='card-title'>Profile</h1>
                    </div>
                    <div class='card-body'>
                        <TablerLoading v-if='loading'/>
                        <template v-else>
                            <div class='row'>
                                <div class='col-12 col-md-6 mb-3'>
                                    <TablerInput disabled label='Username' v-model='profile.username'/>
                                </div>
                                <div class='col-12 col-md-6 mb-3'>
                                    <TablerInput disabled label='Email' v-model='profile.email'/>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler'

export default {
    name: 'Profile',
    components: {
        PageFooter,
    },
    data: function() {
        return {
            loading: true,
            profile: {}
        }
    },
    mounted: async function() {
        await this.getProfile();
    },
    methods: {
        async getProfile() {
            this.loading = true;
            this.profile = await window.std('/login');
            this.loading = false;
        },
    },
    components: {
        TablerInput,
        TablerLoading,
        PageFooter
    }
}
</script>
