// main.js
import { createApp } from "vue";
import App from "./App.vue";
import { createVuetify } from "vuetify";

// FusionCharts 모듈 초기화 (필요한 차트 타입을 등록)

const vuetify = createVuetify({
  // 옵션: 테마, 컴포넌트 커스터마이징 등
});

const app = createApp(App);
app.use(vuetify);
app.mount("#app");
