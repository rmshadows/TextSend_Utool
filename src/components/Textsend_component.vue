<template>
  <div
    class="textsend-component"
    :class="{ dragging }"
    @dragenter.prevent="onDragEnter"
    @dragleave.prevent="onDragLeave"
    @dragover.capture.prevent="onDragOver"
    @drop.capture.prevent="onDrop"
    @paste="onPaste"
  >
    <div class="file-panel">
      <div class="file-toolbar">
        <n-button size="small" title="左键选文件；右键或 Shift+左键选文件夹" @click="btnPickFiles" @contextmenu.prevent="btnPickFolders">文件</n-button>
        <n-button size="small" :disabled="!canCancel" @click="btnCancelFile">取消</n-button>
        <n-button size="small" :disabled="!canClearQueue" title="清空待发列表" @click="btnClearQueue">清空</n-button>
        <n-button size="small" class="inbox-btn" @click="btnOpenInbox">下载目录</n-button>
      </div>
      <div v-if="fileStat.progress" class="file-meter">
        <n-progress type="line" :percentage="progressPct" :show-indicator="false" :height="5" :border-radius="99" />
        <div class="file-meter-text" :title="progressTitle">{{ progressLabel }}</div>
      </div>
      <div v-else-if="queueItems.length" class="file-hint">{{ fileBusy ? "发送中" : "待发" }} {{ queueItems.length }}</div>
      <div v-if="queueItems.length" class="file-queue">
        <div v-for="(it, idx) in queueItems" :key="it.id" class="file-row">
          <span class="file-name" :title="it.path">{{ fileBusy && idx === 0 ? "发送中 · " : "" }}{{ it.tree ? it.tree + '/' + it.rel : it.name }}</span>
          <button type="button" class="row-x" :disabled="fileBusy" @click="btnRemove(it.id)">×</button>
        </div>
      </div>
    </div>
    <!-- 文本框 -->
    <div class="input">
      <div class="input-padding-div">
        <div v-if="pastePreview" class="paste-preview">
          <img class="paste-thumb" :src="pastePreview.thumb || pastePreview.path" title="查看大图" @click="showPasteLarge" />
          <div class="paste-meta">
            <div>图片预览 {{ pasteSizeText }}</div>
            <div class="paste-hint">点发送才传 · Backspace 清除</div>
          </div>
          <button type="button" class="paste-clear" title="清除预览" @click="clearPastePreview">×</button>
        </div>
        <!-- 下面div有多大，文本输入框就有多大 -->
        <div class="input-div">
          <n-input class="input-textarea" @input="inputOnInput" @change="inputOnChange" :value="inputText" type="textarea"
            :clearable=true :placeholder="placeholder" show-count @update-value="inputOnUpdate" autofocus="true"
            :loading="isLoading" @keydown="onInputKeydown" />
        </div>
      </div>
    </div>

    <div class="buttons">
      <div class="ip-wrap" :title="ipAddr">
        <n-select :value="ipAddr" :options="ipAddrList" size="small"
          :render-option="renderIpOption" :render-label="renderIpLabel"
          @update:value="selectOnUpdateValue" @update-show="onIpShow" />
      </div>
      <div class="port-wrap">
        <n-input-number :value="portNumber" :show-button="false"
          :validator="portNumberValidator" size="small" :min="1" :max="65535" placeholder="端口"
          :format="portNumberFormator" @update:value="inputNumberUpdate" />
      </div>
      <n-button size="small" title="左键最多 1 个客户端；右键最多 7 个" @click="btnLaunch" @contextmenu.prevent="btnLaunchContextMenu">
        {{ launchBtnText }}</n-button>
      <n-button size="small" @click="btnChangeMode" :disabled="changeModeBtnStat">
        {{ changeModeBtnText }}</n-button>
      <n-button size="small" @click="btnHelp">帮助</n-button>
      <n-button size="small" @click="btnAbout">关于</n-button>
      <n-modal v-model:show="showHelp">
        <n-card class="help-card" title="帮助" :bordered="false" size="small" role="dialog" aria-modal="true">
          <pre class="help-text">{{ helpText }}</pre>
        </n-card>
      </n-modal>
      <n-modal v-model:show="showModal">
        <n-card style="width: 420px" title="About" :bordered="false" size="small" role="dialog" aria-modal="true">
          名称：{{ mbStore.appName }}
          <br>
          作者：{{ mbStore.author }}
          <br>
          版本：{{ mbStore.version }}
        </n-card>
      </n-modal>
      <n-modal v-model:show="showPasteBig">
        <n-card class="paste-big-card" :title="pasteBigTitle" :bordered="false" size="small" role="dialog" aria-modal="true">
          <img v-if="pasteBigSrc" class="paste-big-img" :src="pasteBigSrc" />
        </n-card>
      </n-modal>
    </div>
    <div v-if="dragging" class="drop-mask">放到这里加入待发</div>
  </div>
</template>

<script setup>
import { NInput, NButton, NSelect, NInputNumber, NCard, NModal, NProgress } from "naive-ui";
import { ref, watch, computed, onMounted, onUnmounted, h } from "vue"
import { useTextsendStore } from '../stores/textsendStore'
import { useMainbodyStore } from '../stores/mainbodyStore'
import { useQrStore } from '../stores/qrStore'
import { useMessage } from 'naive-ui'
import * as js from "../js/tsc"


// 可以在组件中的任意位置访问 `store` 变量 ✨
const tsStore = useTextsendStore();
const mbStore = useMainbodyStore();
const qrStore = useQrStore();

// 弹窗
// const message = useMessage();
// 为了在setup外使用
try {
  window.$message = useMessage();
} catch (e) {
  console.error("useMessage failed:", e);
  window.$message = {
    error: (msg) => console.error(msg),
    success: (msg) => console.log(msg),
    warning: (msg) => console.warn(msg),
    info: (msg) => console.log(msg),
  };
}

// 错误弹窗(写在js文件了)
// const errorMessage = (error) => {
//   message.error(
//     error,
//     {
//       closable: true,
//       duration: 5000
//     }
//   )
// }

// 定义函数
// 文本框
// 更新文本框
const inputOnUpdate = (value) => {
  tsStore.setInputTextValue(value);
}
// 先Update后OnInput最后onChange
const inputOnInput = (value) => {

}
// change是最后调用的
const inputOnChange = (value) => {

}

// 选择框
/**
 * 更新IP列表
 */
const updateIpAddrList = () => {
  const list = js.UgetIpAddrList();
  const cur = tsStore.ipAddr;
  if (cur && !list.some((x) => x.value === cur)) {
    list.unshift({ label: cur, value: cur });
  }
  tsStore.setIpAddrListValue(list);
}
const onIpShow = (show) => {
  if (show) {
    updateIpAddrList();
  }
}
/**
 * 当选择IP内容变动
value: "192.168.30.126"
option: {"label":"192.168.30.126","value":"192.168.30.126"}
 * @param {*} value 
 * @param {*} option 
 */
const selectOnUpdateValue = (value, option) => {
  if (!value || value === tsStore.ipAddr) {
    return;
  }
  tsStore.setIpAddrValue(value);
}

// 端口数字输入
/**
 * 格式化为整数
 * @param {Number} value 
 * 返回String ！
 */
const portNumberFormator = (value) => {
  let ts = String(value);
  if ((value % 1) != 0) {
    // 返回字符串会警告
    // return parseInt(value);
    console.log("格式化数字 =>" + parseInt(value));
    ts = String(parseInt(value));
  }
  return ts;
}
/**
 * 验证端口号是否合规 （要求大于0） 
 * @param {Number} x 
 */
const portNumberValidator = (x) => x > 0;
/**
 * 更新端口号
 * @param {*} value 
 */
const inputNumberUpdate = (value) => {
  tsStore.setPortNumberValue(value);
}
/**
 * 启动按钮事件
 * @param {*} oneClient 仅允许一个客户端连接
 */
const lanuchBtnEvent = (oneClient = true) => {
  // 如果是服务端模式
  if (mbStore.serverMode) {
    // 如果服务启动状态
    if (mbStore.isServerStart) {
      mbStore.serverStop();
    } else {
      if (oneClient) {
        mbStore.serverStart(tsStore.portNumber, 1);
      } else {
        mbStore.serverStart(tsStore.portNumber, 7);
      }
    }
  } else {
    // 客户端模式
    // 如果是连接状态
    if (mbStore.isConnected) {
      // 断开链接
      mbStore.clientStop();
    } else {
      mbStore.clientStart(tsStore.inputText);
    }
  }
}


/**
 * 下面是按钮事件
 */
const btnLaunch = () => {
  lanuchBtnEvent(true);
}
const btnLaunchContextMenu = () => {
  lanuchBtnEvent(false);
}
const sendCurrentText = () => {
  const text = tsStore.inputText;
  if (!mbStore.isConnected || !text || !String(text).trim()) {
    return;
  }
  if (mbStore.serverMode) {
    window.serverSend(text);
  } else {
    window.clientSend(text);
  }
}

const sendSmart = async () => {
  if (pastePreview.value) {
    await sendPastePreview();
    return;
  }
  if (queueItems.value.length) {
    if (!mbStore.isConnected) {
      window.$message.error("未连接");
      return;
    }
    if (fileBusy.value) {
      return;
    }
    try {
      await window.sendFileQueue();
      pollFile();
    } catch (err) {
      window.$message.error(String(err && err.message ? err.message : err));
    }
    return;
  }
  sendCurrentText();
}

const onInputKeydown = (e) => {
  if (pastePreview.value && e.key === "Backspace" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    clearPastePreview();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    sendSmart();
  }
}

const btnChangeMode = () => {
  if (mbStore.disableChangeModeBtn) {
    console.log("按钮已禁用。");
  } else if (mbStore.isConnected) {
    sendSmart();
  } else {
    mbStore.changeServerMode();
  }
}
const btnAbout = () => {
  showModal.value = true;
}
const btnHelp = () => {
  showHelp.value = true;
}

const refreshQr = () => {
  qrStore.refreshServerQr(tsStore.ipAddr, tsStore.portNumber);
}

window.__textsendRefreshQr = refreshQr;

const fileStat = ref({ items: [], busy: false, progress: null, event: null });
const dragging = ref(false);
let dragDepth = 0;
let lastEventSeq = 0;
let fileTimer = null;

const queueItems = computed(() => fileStat.value.items || []);
const fileBusy = computed(() => !!fileStat.value.busy);
const canCancel = computed(() => fileBusy.value || !!(fileStat.value.progress && fileStat.value.progress.incoming));
const canClearQueue = computed(() => queueItems.value.length > 0 && !fileBusy.value);

const progressLabel = computed(() => {
  const p = fileStat.value.progress;
  if (!p) {
    return queueItems.value.length ? `待发 ${queueItems.value.length}` : "";
  }
  const pct = p.total > 0 ? Math.min(100, Math.round(p.done * 100 / p.total)) : 0;
  const xy = p.of > 1 ? `${p.seq}/${p.of} ` : "";
  const dir = p.incoming ? "收" : "发";
  if (p.phase === "awaiting") {
    return `${dir} ${xy}${p.name} 等待对方确认…`;
  }
  const spd = formatSpeed(p.speed);
  return `${dir} ${xy}${p.name} ${pct}% ${spd}`;
});
const progressTitle = computed(() => progressLabel.value);
const progressPct = computed(() => {
  const p = fileStat.value.progress;
  if (!p || !p.total) {
    return 0;
  }
  const raw = Math.min(100, Math.round(p.done * 100 / p.total));
  if (p.phase !== "awaiting" && raw >= 100) {
    return 99;
  }
  return raw;
});

const formatSpeed = (n) => {
  const v = Number(n) || 0;
  if (v <= 0) {
    return "";
  }
  if (v < 1024) {
    return `${Math.round(v)} B/s`;
  }
  if (v < 1024 * 1024) {
    return `${(v / 1024).toFixed(1)} KB/s`;
  }
  return `${(v / 1024 / 1024).toFixed(1)} MB/s`;
};

const pollFile = () => {
  if (typeof window.getFileStat !== "function") {
    return;
  }
  const s = window.getFileStat();
  fileStat.value = s || { items: [], busy: false, progress: null };
  const ev = s && s.event;
  if (ev && ev.seq && ev.seq !== lastEventSeq) {
    lastEventSeq = ev.seq;
    if (ev.text) {
      if (ev.type === "err") {
        window.$message.error(ev.text);
      } else {
        window.$message.success(ev.text);
      }
    }
  }
};

const btnPickFiles = async (e) => {
  try {
    if (e && e.shiftKey) {
      await window.pickAndAddFolders();
    } else {
      await window.pickAndAddFiles();
    }
    pollFile();
  } catch (err) {
    window.$message.error(String(err && err.message ? err.message : err));
  }
};
const btnPickFolders = async () => {
  try {
    await window.pickAndAddFolders();
    pollFile();
  } catch (err) {
    window.$message.error(String(err && err.message ? err.message : err));
  }
};
const btnCancelFile = () => {
  window.cancelFileTransfer();
  pollFile();
};
const btnClearQueue = () => {
  if (fileBusy.value) {
    return;
  }
  window.clearFileQueue();
  pollFile();
};
const btnRemove = (id) => {
  window.removeQueued([id]);
  pollFile();
};
const btnOpenInbox = () => {
  const dir = window.openInboxDir();
  if (dir) {
    window.$message.success(dir);
  }
};
const onDragEnter = () => {
  dragDepth++;
  dragging.value = true;
};
const onDragLeave = () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) {
    dragging.value = false;
  }
};
const pastePreview = ref(null);
const showPasteBig = ref(false);
const pasteBigSrc = ref("");
const pasteSizeText = computed(() => {
  const p = pastePreview.value;
  if (!p) {
    return "";
  }
  return p.width && p.height ? `${p.width}×${p.height}` : "";
});
const pasteBigTitle = computed(() => pasteSizeText.value ? `查看大图  ${pasteSizeText.value}` : "查看大图");

const clearPastePreview = () => {
  pastePreview.value = null;
  showPasteBig.value = false;
  pasteBigSrc.value = "";
};

const setPastePreview = (clip) => {
  if (!clip || !clip.path) {
    return;
  }
  pastePreview.value = clip;
  if (window.$message) {
    window.$message.success("图片已放入输入区，点发送才传");
  }
};

const onPaste = (e) => {
  const clip = window.readClipboardImage && window.readClipboardImage();
  if (clip && clip.path) {
    if (e) {
      e.preventDefault();
    }
    setPastePreview(clip);
  }
};

const showPasteLarge = () => {
  const p = pastePreview.value;
  if (!p || !p.path) {
    return;
  }
  const src = (window.readImageDataUrl && window.readImageDataUrl(p.path)) || p.thumb || "";
  if (!src) {
    window.$message.error("无法打开大图");
    return;
  }
  pasteBigSrc.value = src;
  showPasteBig.value = true;
};

const sendPastePreview = async () => {
  const p = pastePreview.value;
  if (!p || !p.path) {
    return;
  }
  if (!mbStore.isConnected) {
    window.$message.error("未连接");
    return;
  }
  try {
    await window.sendPasteImage(p.path);
    clearPastePreview();
    pollFile();
  } catch (err) {
    window.$message.error(String(err && err.message ? err.message : err));
  }
};

const renderIpOption = ({ node, option }) => {
  return h("div", { title: option.value, class: "ip-option" }, [node]);
};
const renderIpLabel = (option) => {
  return h("span", { title: option && option.value }, option && option.label);
};

const onDragOver = () => {};
const onDrop = (e) => {
  dragDepth = 0;
  dragging.value = false;
  const paths = js.pathsFromDataTransfer(e.dataTransfer);
  if (!paths.length) {
    window.$message && window.$message.error("读不到拖入文件的路径");
    return;
  }
  const n = window.addDroppedPaths(paths);
  pollFile();
  if (!n) {
    window.$message && window.$message.error("没有可加入的文件");
  }
};

onMounted(() => {
  pollFile();
  fileTimer = setInterval(pollFile, 250);
});
onUnmounted(() => {
  if (fileTimer) {
    clearInterval(fileTimer);
    fileTimer = null;
  }
});

watch(() => [tsStore.ipAddr, tsStore.portNumber], (now, prev) => {
  if (!mbStore.isServerStart || !qrStore.pskB64 || !tsStore.ipAddr) {
    return;
  }
  if (prev && now[0] === prev[0] && now[1] === prev[1]) {
    return;
  }
  refreshQr();
});

/**
 *  定义变量 
 */
// const emit = defineEmits(['']);
// 文本框输入的文字
let inputText = computed(() => tsStore.inputText);
let isLoading = computed(() => tsStore.isLoading);
// IP列表
let ipAddrList = computed(() => tsStore.ipAddrList);
// IP地址
let ipAddr = computed(() => tsStore.ipAddr);
// 默认端口
let portNumber = computed(() => tsStore.portNumber);
// 是否显示About / 帮助
let showModal = ref(false);
let showHelp = ref(false);
const helpText = `TextSend uTools  ·  局域网即时投送  ·  ${mbStore.version}

—— 连上 ——
· 选好本机局域网 IP 和端口，点「启动」。左侧出现二维码和 PIN。
· 对面用手机 / PC 扫码，或手输 8 位 PIN。
· 点开 IP 框只是换网卡，不会停服务。真的换了 IP，码会自己更新。
· 点「切换」到客户端：在输入框粘贴 ts://IP/kPIN（端口可省略，默认 54300），再点「连接」。

—— 左键 / 右键不一样 ——
· 「启动」左键：只允许 1 个客户端。右键：最多 7 个。
· 「文件」左键：选扁文件（最多 50）。右键：选文件夹。Shift+左键也是文件夹。
· 二维码：左键复制长密钥连接串。
· PIN：左键复制 ts://…/kPIN；右键只复制 8 位数字。

—— 文字 / 文件 ——
· 连上后只有一个「发送」（底栏；Ctrl+Enter 一样）：有图片预览先发图，有待发就发文件，否则发文字。
· Ctrl+V 剪贴板图片会先出现预览，点「发送」才传；点缩略图看大图，Backspace 清除。
· 「文件」加入待发后再点「发送」。也可把文件/文件夹拖进窗口。「清空」一键清掉待发列表。
· 对面落到「下载/TextSend」，不弹保存框。
· 本机收到的图 ≤20MB 进剪贴板；手机发来的图一律落地。
· 「取消」只停这一轮，待发列表还在。发送方取消对面留半截可续传；接收方取消才删半截。

连不上时：两边同一 Wi‑Fi，关加速 / 双通道；电脑有线和 USB 网卡别挂同一网段。`;
// 文本框默认字
let placeholder = computed(() => tsStore.getInputTextPlaceholder);
let launchBtnText = computed(() => tsStore.getLaunchBtnText);
let changeModeBtnText = computed(() => tsStore.getChangeModeBtnText);
// 按钮状态
let changeModeBtnStat = computed(() => mbStore.getDisableChangeModeBtn);




// IPC通信，未使用
// window.ping((event, value) => {
//   console.log("event" + "IPC Renderer: 接受Ping -> " + value);
// });

// 初始化（preload 未就绪时不要拖垮整块 UI）
try {
  updateIpAddrList();
  tsStore.setIpAddrValue(js.getDefaultIpAddr(tsStore.ipAddrList));
} catch (e) {
  console.error("Init IP list failed:", e);
}
// 测试utools API
// window.showPath();
</script>


<style scoped lang="less">
.textsend-component {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

.file-panel {
  flex: 0 0 auto;
  padding: 6px 8px 0;
  box-sizing: border-box;
}

.file-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.inbox-btn {
  margin-left: auto;
}

.file-meter,
.file-hint {
  margin-top: 8px;
}

.file-meter-text,
.file-hint {
  font-size: 12px;
  color: var(--ts-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meter-text {
  margin-top: 4px;
}

.file-queue {
  margin-top: 6px;
  max-height: 72px;
  overflow: auto;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
  font-size: 12px;
}

.file-name {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-x {
  border: 0;
  background: none;
  color: var(--ts-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}

.row-x:hover:not(:disabled) {
  color: var(--ts-danger);
}

.row-x:disabled {
  opacity: 0.35;
  cursor: default;
}

.drop-mask {
  position: absolute;
  inset: 8px;
  border: 1.5px dashed var(--ts-accent);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--ts-ink);
  pointer-events: none;
  z-index: 3;
}

.input {
  flex: 1 1 auto;
  min-height: 0;

  .input-padding-div {
    padding: 6px 8px;
    box-sizing: border-box;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .input-div {
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
  }

  .input-textarea {
    height: 100%;
    font-size: 14px;
  }

  :deep(.n-input) {
    height: 100%;
  }

  :deep(.n-input-wrapper) {
    height: 100%;
  }

  :deep(textarea.n-input__textarea-el) {
    height: 100% !important;
  }
}

.buttons {
  width: 100%;
  flex: 0 0 auto;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  padding: 0 8px 6px;
  box-sizing: border-box;
}

.ip-wrap {
  flex: 1 1 auto;
  min-width: 120px;

  :deep(.n-select) {
    width: 100%;
  }

  :deep(.n-base-selection-label),
  :deep(.n-base-selection-input) {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.port-wrap {
  flex: 0 0 68px;
  width: 68px;

  :deep(.n-input-number) {
    width: 100%;
  }
}

.buttons :deep(.n-button) {
  flex: 0 0 auto;
}

.help-card {
  width: min(520px, 92vw);
}

.help-text {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.55;
}

.paste-preview {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding: 6px 8px;
  border: 1px solid var(--ts-line);
  border-radius: 8px;
  background: var(--ts-surface);
}

.paste-thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 4px;
  cursor: pointer;
  background: #f3f4f6;
}

.paste-meta {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
}

.paste-hint {
  margin-top: 2px;
  font-size: 12px;
  color: var(--ts-muted);
}

.paste-clear {
  border: 0;
  background: none;
  color: var(--ts-muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 2px;
}

.paste-clear:hover {
  color: var(--ts-danger);
}

.paste-big-card {
  width: min(720px, 92vw);
  max-height: 85vh;
}

.paste-big-img {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  margin: 0 auto;
  object-fit: contain;
}

.ip-option {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>


