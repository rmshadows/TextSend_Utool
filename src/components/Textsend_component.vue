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
          <n-input class="input-textarea" :value="inputText" type="textarea"
            :clearable=true :placeholder="placeholder" show-count @update-value="inputOnUpdate" autofocus="true"
            :loading="isLoading" @keydown="onInputKeydown" />
        </div>
      </div>
    </div>

    <div class="control-panel">
      <div class="control-row control-row--main">
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
        <n-button type="primary" size="small" class="launch-btn"
          title="左键最多 1 个客户端；右键最多 7 个" @click="btnLaunch" @contextmenu.prevent="btnLaunchContextMenu">
          {{ launchBtnText }}</n-button>
        <n-button size="small" @click="btnChangeMode" :disabled="changeModeBtnStat">
          {{ changeModeBtnText }}</n-button>
      </div>
      <div class="control-row control-row--secondary">
        <div v-if="mbStore.serverMode" class="control-row-left">
          <n-checkbox class="auto-start-chk" size="small"
            :checked="autoStartServer" title="打开插件后自动启动服务端（不额外弹窗）"
            @update:checked="onAutoStartChange">启动即开服</n-checkbox>
          <n-checkbox class="custom-pin-chk" size="small" :checked="customPinEnabled"
            title="开启后每次启动服务端使用同一 8 位 PIN（默认关）"
            @update:checked="onCustomPinEnabledChange">固定 PIN</n-checkbox>
          <n-input v-model:value="customPinDraft" class="custom-pin-input" size="small" maxlength="8"
            placeholder="8位数字" title="先输入 8 位数字，再勾选「固定 PIN」"
            :allow-input="onlyPinDigits" @blur="onCustomPinBlur" />
        </div>
        <div v-else class="control-row-left">
          <n-checkbox class="remember-client-chk" size="small" :checked="rememberClientConnection"
            title="下次进入客户端模式自动填入上次成功的 IP、端口和 PIN（默认关，不记长密钥）"
            @update:checked="onRememberClientChange">记住上次连接</n-checkbox>
        </div>
        <div class="control-row-nav">
          <n-button size="small" @click="btnHelp">帮助</n-button>
          <n-button size="small" @click="btnAbout">关于</n-button>
        </div>
      </div>
      <n-modal v-model:show="showHelp">
        <n-card class="help-card" title="帮助" :bordered="false" size="small" role="dialog" aria-modal="true">
          <pre class="help-text">{{ helpText }}</pre>
        </n-card>
      </n-modal>
      <n-modal v-model:show="showModal" class="about-modal" :auto-focus="false">
        <n-card class="about-card" title="关于" :bordered="false" size="small" role="dialog" aria-modal="true">
          <div class="about-line">名称：{{ mbStore.appName }}</div>
          <div class="about-line">作者：{{ mbStore.author }}</div>
          <div class="about-line">版本：{{ mbStore.version }}</div>
          <div class="about-download">
            <div class="about-download-title">Android 客户端下载</div>
            <div class="about-download-links">
              <div class="about-link-wrap"
                @mouseenter="onDownloadHover('github')" @mouseleave="onDownloadLeave">
                <button type="button" class="about-link" @click="openAndroidGithub">GitHub</button>
                <div v-if="hoverDownloadQr === 'github'" class="about-qr-pop">
                  <img v-if="downloadQrSrc.github" class="about-qr-img" :src="downloadQrSrc.github" alt="GitHub 下载" width="80" height="80" />
                  <span v-else class="about-qr-hint">加载中…</span>
                  <span v-if="downloadQrSrc.github" class="about-qr-hint">扫码下载</span>
                </div>
              </div>
              <div class="about-link-wrap"
                @mouseenter="onDownloadHover('gitee')" @mouseleave="onDownloadLeave">
                <button type="button" class="about-link" @click="openAndroidGitee">Gitee</button>
                <div v-if="hoverDownloadQr === 'gitee'" class="about-qr-pop">
                  <img v-if="downloadQrSrc.gitee" class="about-qr-img" :src="downloadQrSrc.gitee" alt="Gitee 下载" width="80" height="80" />
                  <span v-else class="about-qr-hint">加载中…</span>
                  <span v-if="downloadQrSrc.gitee" class="about-qr-hint">扫码下载</span>
                </div>
              </div>
            </div>
            <div class="about-download-note">悬停看二维码 · 点击用浏览器打开</div>
          </div>
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
import { NInput, NButton, NSelect, NInputNumber, NCard, NModal, NProgress, NCheckbox } from "naive-ui";
import { ref, watch, computed, onMounted, onUnmounted, h } from "vue"
import { useTextsendStore } from '../stores/textsendStore'
import { useMainbodyStore } from '../stores/mainbodyStore'
import { useQrStore } from '../stores/qrStore'
import { useMessage } from 'naive-ui'
import * as js from "../js/tsc"
import * as settings from "../js/settings"
import { ANDROID_DOWNLOAD, openExternalUrl, ensureLinkQrImg } from "../js/links"


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

// 错误弹窗见 tsc.js errorHandler

// 定义函数
// 文本框
// 更新文本框
const inputOnUpdate = (value) => {
  tsStore.setInputTextValue(value);
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
 * 当选择 IP 变动
 */
const selectOnUpdateValue = (value, option) => {
  if (!value || value === tsStore.ipAddr) {
    return;
  }
  tsStore.setIpAddrValue(value);
  settings.setSavedListenIp(value);
}

// 端口数字输入
/**
 * 格式化为整数
 * @param {Number} value 
 * 返回String ！
 */
const portNumberFormator = (value) => {
  if ((value % 1) != 0) {
    return String(parseInt(value));
  }
  return String(value);
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
  settings.setSavedListenPort(value);
}

const autoStartServer = ref(settings.getAutoStartServer());
let autoStartLaunched = false;

const onAutoStartChange = (checked) => {
  autoStartServer.value = !!checked;
  settings.setAutoStartServer(checked);
}

const customPinEnabled = ref(settings.getCustomPinEnabled());
const customPinDraft = ref(settings.getCustomPin());
const rememberClientConnection = ref(settings.getRememberClientConnection());

const onRememberClientChange = (checked) => {
  rememberClientConnection.value = !!checked;
  settings.setRememberClientConnection(checked);
};

const prefillClientConnection = () => {
  if (mbStore.serverMode || mbStore.isConnected) {
    return;
  }
  settings.prefillClientConnectionIfNeeded((raw) => tsStore.setInputValueSync(raw));
};

const onlyPinDigits = (value) => !value || /^\d*$/.test(value);

const onCustomPinEnabledChange = (checked) => {
  if (checked && !settings.isValidPin(customPinDraft.value)) {
    window.$message && window.$message.error("请先输入 8 位数字，再勾选固定 PIN");
    customPinEnabled.value = false;
    return;
  }
  customPinEnabled.value = !!checked;
  settings.setCustomPinEnabled(checked);
};

const onCustomPinBlur = () => {
  const pin = String(customPinDraft.value || "").trim();
  if (pin && !settings.isValidPin(pin)) {
    window.$message && window.$message.error("PIN 须为 8 位数字");
    customPinDraft.value = settings.getCustomPin();
    return;
  }
  customPinDraft.value = pin;
  settings.setCustomPin(pin);
};
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
    const toClient = mbStore.serverMode;
    mbStore.changeServerMode();
    if (toClient) {
      prefillClientConnection();
    } else {
      tsStore.setInputValueSync("");
    }
  }
}
const btnAbout = () => {
  showModal.value = true;
  preloadDownloadQrs();
}
const openAndroidGithub = () => openExternalUrl(ANDROID_DOWNLOAD.github);
const openAndroidGitee = () => openExternalUrl(ANDROID_DOWNLOAD.gitee);

const hoverDownloadQr = ref(null);
const downloadQrSrc = ref({ github: "", gitee: "" });

const ensureDownloadQr = (key) => {
  const url = ANDROID_DOWNLOAD[key];
  if (!url || downloadQrSrc.value[key]) {
    return;
  }
  ensureLinkQrImg(url, (src) => {
    if (src && !downloadQrSrc.value[key]) {
      downloadQrSrc.value = { ...downloadQrSrc.value, [key]: src };
    }
  });
};

const preloadDownloadQrs = () => {
  ensureDownloadQr("github");
  ensureDownloadQr("gitee");
};

const onDownloadHover = (key) => {
  hoverDownloadQr.value = key;
  ensureDownloadQr(key);
};

const onDownloadLeave = () => {
  hoverDownloadQr.value = null;
};

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
  if (!autoStartLaunched && mbStore.serverMode && autoStartServer.value && !mbStore.isServerStart) {
    autoStartLaunched = true;
    mbStore.serverStart(tsStore.portNumber, 1);
  }
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
· 可勾选「启动即开服」：下次打开插件自动开服（默认关）。会记住上次选的 IP，换网后不在列表则自动重选。
· 可勾选「固定 PIN」并输入 8 位数字：每次启动服务端用同一 PIN（默认关，随机 PIN + 长密钥）。
· 左侧二维码：点击复制长密钥连接串；启动服务时也会自动复制。
· 对面用手机 / PC 扫码，或手输 8 位 PIN。
· 点开 IP 框只是换网卡，不会停服务。真的换了 IP，码会自己更新。
· 点「切换」到客户端：在输入框粘贴 ts://IP/kPIN（端口可省略，默认 54300），再点「连接」。
· 客户端可勾选「记住上次连接」：PIN 连成功后记住 IP、端口和 PIN（默认关，不记长密钥）。

—— 左键 / 右键不一样 ——
· 「启动」左键：只允许 1 个客户端。右键：最多 7 个。
· 「文件」左键：选扁文件（最多 50）。右键：选文件夹。Shift+左键也是文件夹。
· PIN：左键复制 ts://…/kPIN；右键只复制 8 位数字。

—— 文字 / 文件 ——
· 连上后只有一个「发送」（底栏；Ctrl+Enter 一样）：有图片预览先发图，有待发就发文件，否则发文字。
· Ctrl+V 剪贴板图片会先出现预览，点「发送」才传；点缩略图看大图，Backspace 清除。
· 「文件」加入待发后再点「发送」。也可把文件/文件夹拖进窗口。「清空」一键清掉待发列表。
· 对面落到「下载/TextSend」，不弹保存框。
· 本机收到的图 ≤20MB 进剪贴板；手机发来的图一律落地。
· 「取消」只停这一轮，待发列表还在。发送方取消对面留半截可续传；接收方取消才删半截。

连不上时：两边同一 Wi‑Fi，关加速 / 双通道；电脑有线和 USB 网卡别挂同一网段。

—— 其他端 ——
· Android APK：点「关于」→ 悬停 GitHub / Gitee 看二维码，点击用浏览器打开。`;
// 文本框默认字
let placeholder = computed(() => tsStore.getInputTextPlaceholder);
let launchBtnText = computed(() => tsStore.getLaunchBtnText);
let changeModeBtnText = computed(() => tsStore.getChangeModeBtnText);
// 按钮状态
let changeModeBtnStat = computed(() => mbStore.getDisableChangeModeBtn);

// 初始化（preload 未就绪时不要拖垮整块 UI）
try {
  updateIpAddrList();
  tsStore.setPortNumberValue(settings.getSavedListenPort());
  tsStore.setIpAddrValue(settings.resolveListenIp(tsStore.ipAddrList));
} catch (e) {
  console.error("Init IP list failed:", e);
}
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

.control-panel {
  width: 100%;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 8px 6px;
  box-sizing: border-box;
}

.control-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.control-row--secondary {
  justify-content: flex-end;
}

.control-row-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
  margin-right: auto;
}

.control-row-nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  flex: 0 0 auto;
}

.launch-btn {
  flex: 0 0 auto;
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

.auto-start-chk {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 12px;
}

.remember-client-chk {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 12px;
}

.custom-pin-chk {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 12px;
}

.custom-pin-input {
  flex: 1 1 108px;
  min-width: 108px;
  max-width: 160px;

  :deep(.n-input) {
    width: 100%;
  }

  :deep(.n-input__input-el) {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.05em;
  }
}

.control-row :deep(.n-button) {
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

.about-modal :deep(.n-card) {
  width: max-content;
  max-width: min(300px, 92vw);
}

.about-modal :deep(.n-card__content) {
  padding-top: 4px;
}

.about-card {
  width: max-content;
}

.about-line {
  font-size: 13px;
  line-height: 1.65;
  white-space: nowrap;
}

.about-download {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--ts-line);
}

.about-download-title {
  font-size: 12px;
  color: var(--ts-muted);
  margin-bottom: 8px;
}

.about-download-note {
  margin-top: 6px;
  font-size: 11px;
  color: var(--ts-muted);
}

.about-download-links {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
}

.about-link-wrap {
  position: relative;
  flex: 0 0 auto;
}

.about-link {
  display: inline-block;
  border: 1px solid var(--ts-line);
  background: var(--ts-chip);
  color: var(--ts-accent);
  border-radius: 6px;
  padding: 5px 16px;
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
  white-space: nowrap;
}

.about-link:hover {
  border-color: var(--ts-accent);
}

.about-qr-pop {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 6px);
  transform: translateX(-50%);
  z-index: 20;
  width: 96px;
  padding: 6px;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid var(--ts-line);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  pointer-events: none;
  overflow: hidden;
}

.about-qr-img {
  display: block;
  width: 80px !important;
  height: 80px !important;
  max-width: 80px;
  max-height: 80px;
  object-fit: contain;
  background: #fff;
}

.about-qr-hint {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  line-height: 1.2;
  color: var(--ts-muted);
  text-align: center;
  white-space: nowrap;
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


