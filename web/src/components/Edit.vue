<template>
<div>
    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class='card'>
                    <div class='card-header d-flex'>
                        <h1 class='card-title'>Edit Stack</h1>
                    </div>
                    <div class='card-body'>
                        <TablerLoading v-if='loading'/>
                        <template v-else>
                            <div class='row'>
                                <div class='col-12 col-md-6 mb-3'>
                                    <TablerInput label='Desired GPU Instances' v-model='status.gpu.desired'/>
                                </div>
                                <div class='col-12 col-md-6 mb-3'>
                                    <TablerInput label='Desired CPU Instances' v-model='status.cpu.desired'/>
                                </div>
                                <div class='col-12 d-flex'>
                                    <div class='ms-auto'>
                                        <button @click='submit' class='btn btn-primary'>Submit</button>
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
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler'

export default {
    name: 'Edit',
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
        },
        async submit() {
            try {
                this.loading = true;
                await window.std('/status', {
                    method: 'POST',
                    body: {
                        gpu: parseInt(this.status.gpu.desired),
                        cpu: parseInt(this.status.cpu.desired)
                    }
                });
                this.loading = false;

                this.$router.push('/');
            } catch (err) {
                this.loading = false;
                throw err;
            }
        }
    },
    components: {
        TablerInput,
        TablerLoading,
        PageFooter
    }
}
</script>
