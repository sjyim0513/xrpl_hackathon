<template>
  <div>
    <div
      class="item-Contaier"
      v-for="([key, value], index) in Object.entries(info)"
      :key="index"
    >
      <div class="item-key-Container">{{ key }} :</div>
      <div class="item-value-Container">
        {{ value }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  info: Record<string, any>;
}>();
</script>

<style>
.item-Contaier {
  display: flex;
  padding: 15px;
  background-color: #181818;
  border-radius: 15px;
  margin: 20px 10px 10px 10px;
  align-content: center;
}

.item-key-Container {
  margin-right: 10px;
}
</style>
