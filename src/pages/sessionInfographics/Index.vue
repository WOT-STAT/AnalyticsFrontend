<template>
  <div class="center-container">
    <h1>Сессионная инфографика</h1>
    <h2>Бои</h2>
    <Battle />
    <h2>Стрельба</h2>
    <Shots />
  </div>
</template>

<script setup lang="ts">
import Battle from "./Battle.vue";
import Shots from "./Shots.vue";

</script>

<style lang="scss">
@import '@/styles/mixins.scss';

.card {
  padding: 15px;
}

.hor-ver-x-small {
  @include less-x-small {
    flex-direction: column;
  }
}
</style>