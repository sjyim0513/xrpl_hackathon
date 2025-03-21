<template>
  <v-card v-if="transactions.length" class="ma-4" outlined>
    <v-card-title>선택된 트랜잭션 정보</v-card-title>
    <v-card-text>
      <v-list dense>
        <v-list-item v-for="(tx, index) in transactions" :key="index">
          <v-list-item-content>
            <v-list-item-title>{{ tx.account }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ formatTxInfo(tx) }}
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { defineProps } from "vue";

interface TxData {
  account: string;
  // tx 객체에 포함된 추가 필드들
  Account: string;
  Fee: string;
  deliveredAmount?: string;
  // 필요한 필드 추가…
}

const props = defineProps<{
  transactions: TxData[];
}>();

function formatTxInfo(tx: TxData): string {
  // 예시: Account, Fee, deliveredAmount 등 원하는 정보를 포맷
  return `Account: ${tx.Account}, Fee: ${tx.Fee}`;
}
</script>
