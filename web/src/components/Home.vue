<template>
<div>
    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class='card'>
                    <div class='card-header d-flex'>
                        <h1 class='card-title'>Stack Status</h1>
                        <div class='ms-auto btn-list'>
                            <RefreshIcon @click='getStatus' class='cursor-pointer'/>
                            <SettingsIcon @click='$router.push("/edit")' class='cursor-pointer'/>
                        </div>
                    </div>
                    <div class='card-body'>
                        <TablerLoading v-if='loading'/>
                        <template v-else>
                            <div class='row'>
                                <div class='col-12 col-md-6 mb-3'>
                                    <div class='mx-2'>
                                        <div class='subheader'>CPU Service Status</div>
                                        <div class='border round row'>
                                            <div class='col-4 py-3'>
                                                <div class='d-flex justify-content-center'>
                                                    <Status key='warning' status='Warning'/>
                                                </div>
                                                <div class='d-flex justify-content-center'>
                                                    <span class='mx-1' v-text='status.cpu.pending'/> Pending
                                                </div>
                                            </div>
                                            <div class='col-4 py-3'>
                                                <div class='d-flex justify-content-center'>
                                                    <Status key='success' status='Success'/>
                                                </div>
                                                <div class='d-flex justify-content-center'>
                                                    <span class='mx-1' v-text='status.cpu.running'/> Running
                                                </div>
                                            </div>
                                            <div class='col-4 py-3'>
                                                <div class='d-flex justify-content-center'>
                                                    <Status key='desired' status='Success'/>
                                                </div>
                                                <div class='d-flex justify-content-center'>
                                                    <span class='mx-1' v-text='status.cpu.desired'/> Desired
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class='col-12 col-md-6 mb-3'>
                                    <div class='mx-2'>
                                        <div class='subheader'>GPU Service Status</div>
                                        <div class='border round row'>
                                            <div class='col-4 py-3'>
                                                <div class='d-flex justify-content-center'>
                                                    <Status key='warning' status='Warning'/>
                                                </div>
                                                <div class='d-flex justify-content-center'>
                                                    <span class='mx-1' v-text='status.gpu.pending'/> Pending
                                                </div>
                                            </div>
                                            <div class='col-4 py-3'>
                                                <div class='d-flex justify-content-center'>
                                                    <Status key='success' status='Success'/>
                                                </div>
                                                <div class='d-flex justify-content-center'>
                                                    <span class='mx-1' v-text='status.gpu.running'/> Running
                                                </div>
                                            </div>
                                            <div class='col-4 py-3'>
                                                <div class='d-flex justify-content-center'>
                                                    <Status key='desired' status='Success'/>
                                                </div>
                                                <div class='d-flex justify-content-center'>
                                                    <span class='mx-1' v-text='status.gpu.desired'/> Desired
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class='mb-3'>
                                    <div class='mx-2'>
                                        <div class='subheader'>Loaded Models</div>
                                        <div class='border round row'>
                                            <div :key='model' v-for='model in status.models' class='col-12 my-2'>
                                                <FileAnalyticsIcon/><span v-text='model'/>
                                            </div>
                                        </div>
                                    </div>
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
import Status from './util/Status.vue';
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler'

import {
    SettingsIcon,
    RefreshIcon,
    FileAnalyticsIcon,
} from 'vue-tabler-icons';

export default {
    name: 'Home',
    components: {
        PageFooter,
    },
    data: function() {
        return {
            loading: true,
            status: {}
        }
    },
    mounted: async function() {
        await this.getStatus();
    },
    methods: {
        async getStatus() {
            this.loading = true;
            this.status = await window.std('/status');
            this.loading = false;
        }
    },
    components: {
        Status,
        FileAnalyticsIcon,
        SettingsIcon,
        RefreshIcon,
        TablerInput,
        TablerLoading,
        PageFooter
    }
}
</script>
