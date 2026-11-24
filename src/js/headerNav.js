import { ref } from "vue";

/** 顶栏右侧按钮与主界面联动。 */
export const headerWebVisible = ref(false);
export const headerWebRunning = ref(false);

const handlers = {
  web: null,
  help: null,
  about: null,
};

export function setHeaderHandlers(next) {
  handlers.web = typeof next.web === "function" ? next.web : null;
  handlers.help = typeof next.help === "function" ? next.help : null;
  handlers.about = typeof next.about === "function" ? next.about : null;
}

export function clearHeaderHandlers() {
  handlers.web = null;
  handlers.help = null;
  handlers.about = null;
}

export function runHeader(action) {
  const fn = handlers[action];
  if (fn) {
    fn();
  }
}
