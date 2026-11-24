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
        <n-button size="small" title="左键选文件（最多 50）；右键或 Shift+左键选文件夹"
          @click="btnPickFiles" @contextmenu.prevent="btnPickFolders">文件</n-button>
        <n-button size="small" :disabled="!canCancel" title="只停这一轮传输，待发列表还在"
          @click="btnCancelFile">取消</n-button>
        <n-button size="small" :disabled="!canClearQueue" title="清空待发列表（不影响正在传的）"
          @click="btnClearQueue">清空</n-button>
        <div v-if="mbStore.serverMode && mbStore.isServerStart" class="session-btns">
          <n-button size="small" :type="authPending.length ? 'primary' : 'default'"
            title="点开处理授权。先对核对码，再允许、拒绝或拉黑"
            @click="openAuthDialog">待授权 {{ authPending.length }}</n-button>
          <n-button size="small"
            title="点开查看已连接的设备，可踢下线"
            @click="openClientsDialog">已连接 {{ aliveClients.length }}{{ mbStore.maxConnections > 1 ? ' / ' + mbStore.maxConnections : '' }}</n-button>
        </div>
        <n-button size="small" class="inbox-btn" title="用资源管理器打开本机「下载/TextSend」"
          @click="btnOpenInbox">下载目录</n-button>
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
          :title="mbStore.serverMode
            ? (mbStore.isServerStart
              ? '停止服务（已连接客户端会断开）'
              : ('左键最多 1 人并开服；右键最多 ' + maxClients + ' 人（设置可改）'))
            : (mbStore.isConnected ? '断开连接' : '连接：输入框须为 ts://…/k…')"
          @click="btnLaunch" @contextmenu.prevent="btnLaunchContextMenu">
          {{ launchBtnText }}</n-button>
        <n-button size="small"
          title="在服务端 / 客户端之间切换（已连接时不可用）"
          @click="btnChangeMode" :disabled="changeModeBtnStat">
          {{ changeModeBtnText }}</n-button>
        <n-button size="small"
          title="局域网探测、授权限流/冷却/黑名单、右键启动上限等"
          @click="openSettings">设置</n-button>
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
          <span v-if="lanDiscover" class="lan-on-hint" title="探测已开；详细选项在「设置」">探测开</span>
        </div>
        <div v-else class="control-row-left">
          <n-checkbox class="remember-client-chk" size="small" :checked="rememberClientConnection"
            title="下次进入客户端模式自动填入上次成功的 IP、端口和 PIN（默认关，不记长密钥）"
            @update:checked="onRememberClientChange">记住上次连接</n-checkbox>
          <span v-if="lanDiscover" class="lan-on-hint" title="探测已开；详细选项在「设置」">探测开</span>
        </div>
      </div>
      <div v-if="!mbStore.serverMode && lanDiscover" class="lan-peers">
        <div class="lan-peers-title">
          <span v-if="lanProbing" class="lan-probe-light" title="正在探测" aria-hidden="true"></span>
          <span class="lan-peers-label">{{ lanPeerLabel }}</span>
        </div>
        <button v-for="p in lanPeers" :key="p.host + ':' + p.tcpPort" type="button" class="lan-peer"
          :class="{ 'lan-peer--sas': !!authSasByHost[p.host] }"
          :title="lanPeerTitle(p)"
          @click="applyLanPeer(p)">
          <span>{{ lanPeerText(p) }}</span>
          <small v-if="authSasByHost[p.host]" class="lan-peer-sas">核对 {{ authSasByHost[p.host] }} · 再点取消</small>
        </button>
      </div>
      <n-modal v-model:show="showAuthPanel">
        <n-card class="session-card" title="待授权" :bordered="false" size="small" role="dialog" aria-modal="true">
          <div v-if="!authPending.length" class="session-empty">没有待处理的授权</div>
          <div v-else class="auth-panel" @click="sessionFocus = 'auth'">
            <div v-for="(p, i) in authPending" :key="p.host" class="auth-row"
              :class="{ 'auth-row--on': sessionFocus === 'auth' && i === authIndex }"
              @click="sessionFocus = 'auth'; authIndex = i">
              <div class="auth-name" :title="p.host">
                <div>{{ p.name }}</div>
                <div class="auth-host">{{ p.host }}<template v-if="p.sas"> · 核对 {{ p.sas }}</template></div>
              </div>
              <span class="auth-actions">
                <button type="button" class="auth-btn" title="核对码与对方一致后再允许（Alt+Y）"
                  @click="onAuthDecide(p.host, 'allow')">允许</button>
                <button type="button" class="auth-btn" title="拒绝并进入冷却（Alt+N）"
                  @click="onAuthDecide(p.host, 'deny')">拒绝</button>
                <button type="button" class="auth-btn" title="加入黑名单并拒绝（Alt+B）"
                  @click="onAuthDecide(p.host, 'blacklist')">拉黑</button>
              </span>
            </div>
            <button v-if="authPending.length > 1" type="button" class="auth-btn auth-btn--all"
              title="拒绝当前全部请求并分别进入冷却"
              @click="onAuthDenyAll">全部拒绝</button>
          </div>
          <div class="auth-keys">Alt+Y 允许 · Alt+N 拒绝 · Alt+B 拉黑 · ↑↓ 换一台。作用在蓝框那台。</div>
        </n-card>
      </n-modal>
      <n-modal v-model:show="showClientsPanel">
        <n-card class="session-card" title="已连接" :bordered="false" size="small" role="dialog" aria-modal="true">
          <div v-if="!aliveClients.length" class="session-empty">当前没有客户端</div>
          <div v-else class="auth-panel" @click="sessionFocus = 'clients'">
            <div v-for="(c, i) in aliveClients" :key="c.host + ':' + c.port" class="auth-row"
              :class="{ 'auth-row--on': sessionFocus === 'clients' && i === clientIndex }"
              @click="sessionFocus = 'clients'; clientIndex = i">
              <div class="auth-name"
                :title="'对端 IP' + (c.name ? ' · 设备名来自授权请求' : '') + '（临时连接口 ' + c.port + '，仅区分同 IP 多开）'">
                <div>{{ c.label || c.host }}</div>
              </div>
              <button type="button" class="auth-btn" :title="'断开 ' + c.host + '，服务继续运行（Alt+K）'"
                @click="onKick(c.host)">踢下线</button>
            </div>
            <button v-if="aliveClients.length > 1" type="button" class="auth-btn auth-btn--all"
              title="断开所有客户端，服务继续运行"
              @click="onKickAll">全部踢下线</button>
          </div>
          <div class="auth-keys">Alt+K 踢下线 · Alt+B 拉黑并踢下线 · ↑↓ 换一台。作用在蓝框那台。</div>
        </n-card>
      </n-modal>
      <n-modal v-model:show="showSettings">
        <n-card class="help-card" title="设置" :bordered="false" size="small" role="dialog" aria-modal="true">
          <div class="settings-form">
            <n-checkbox :checked="draftLanDiscover"
              title="默认关。打开后可被发现，并允许客户端请求临时授权（须本机点允许）。"
              @update:checked="onDraftLanDiscover">局域网探测</n-checkbox>
            <n-checkbox :checked="draftLanPause" :disabled="!draftLanDiscover"
              title="默认开。已有连接时暂停广播和探测，授权仍然收。"
              @update:checked="onDraftLanPause">有连接时关闭探测</n-checkbox>
            <n-checkbox :checked="draftLanAnnounce" :disabled="!draftLanDiscover"
              title="默认开，大约每 1 秒广播一次。关掉后不主动喊，只在别人发探测时回复。"
              @update:checked="onDraftLanAnnounce">主动广播在线</n-checkbox>
            <n-checkbox :checked="draftLanFollow" :disabled="!draftLanDiscover"
              title="默认开。开着时探测 UDP 口等于连接端口，下面的输入框禁用。"
              @update:checked="onDraftLanFollow">探测端口跟随连接端口</n-checkbox>
            <label class="settings-row" title="和连接同一端口号，默认 54300，协议是 UDP。两端要一致。防火墙若只放了 TCP，还要放行 UDP。">探测端口
              <n-input-number v-model:value="draftLanPort" :min="1" :max="65535" :show-button="false"
                size="small" :disabled="!draftLanDiscover || draftLanFollow" />
            </label>
            <label class="settings-row" title="1–64。左键启动仍为 1 人；右键启动用此上限。下次启动生效。">右键启动最多客户端
              <n-input-number v-model:value="draftMaxClients" :min="1" :max="64" :show-button="false" size="small" />
            </label>
            <label class="settings-row" title="同一 IP 每分钟最多几条授权请求；超出静默拒绝。默认 3。">授权限流（次/分·IP）
              <n-input-number v-model:value="draftAuthRate" :min="1" :max="60" :show-button="false" size="small" />
            </label>
            <label class="settings-row" title="点「拒绝」后该 IP 冷却期内静默拒绝。0=不冷却，默认 10。改短对已经在冷却的地址立刻生效。">拒绝后冷却（秒）
              <n-input-number v-model:value="draftAuthCool" :min="0" :max="86400" :show-button="false" size="small" />
            </label>
            <div class="settings-bl">
              <div class="settings-bl-title" title="名单内 IP 的授权请求一律静默拒绝">授权黑名单</div>
              <div class="settings-bl-list">
                <div v-if="draftBlacklistItems.length === 0" class="settings-bl-empty">（空）</div>
                <div v-for="ip in draftBlacklistVisible" :key="ip" class="settings-bl-row">
                  <button type="button" class="settings-bl-ip" :title="'点击编辑 ' + ip"
                    @click="startBlacklistEdit(ip)">{{ ip }}</button>
                  <button type="button" class="settings-bl-del" title="删除这条"
                    @click="removeBlacklistItem(ip)">×</button>
                </div>
              </div>
              <n-input v-model:value="draftBlacklistInput" size="small" placeholder="输入 IP，回车添加"
                title="IPv4/IPv6；点上面条目可改，再回车确认。也可在待授权点「拉黑」"
                @keydown.enter.prevent="commitBlacklistInput" />
              <div class="settings-bl-tip">点条目编辑，右侧 × 整条删除</div>
            </div>
            <div class="settings-hint">平时请扫码。打开探测后：客户端点设备会进「待授权」，两边先显示同一串核对码，对得上再点允许。授权优先走 TCP。限流/冷却/黑名单防骚扰。默认探测口跟着连接端口。</div>
            <div class="settings-actions">
              <n-button size="small" title="探测、授权、端口、固定 PIN、记住的连接回到默认。正在运行的服务不中断。"
                @click="resetSettings">恢复默认设置</n-button>
              <n-button size="small" @click="showSettings = false">取消</n-button>
              <n-button type="primary" size="small" @click="saveSettings">保存</n-button>
            </div>
          </div>
        </n-card>
      </n-modal>
      <n-modal v-model:show="showWeb">
        <n-card class="web-card" title="兼容模式" :bordered="false" size="small" role="dialog" aria-modal="true">
          <div class="web-ways">
            <button type="button" class="web-chip" :class="{ on: webWay === 'A' }" @click="webWay = 'A'">A 明文</button>
            <button type="button" class="web-chip" :class="{ on: webWay === 'B' }" @click="webWay = 'B'">B 加密</button>
            <button type="button" class="web-chip" :class="{ on: webWay === 'C' }" @click="webWay = 'C'">C 证书</button>
          </div>
          <div class="web-hint">{{ webHint }}</div>
          <n-input-number class="web-port" :value="webPort" :show-button="false" size="small"
            :min="1" :max="65535" placeholder="端口" @update:value="onWebPort" />
          <n-button type="primary" size="small" class="web-go" @click="toggleWebBridge">{{ webRunning ? "停止" : "启动" }}</n-button>
          <n-button v-if="webWay === 'C'" size="small" class="web-go web-side" @click="revealWebCa">根证书</n-button>
          <div class="web-state">{{ webState }}</div>
          <div class="web-actions">
            <n-button size="small" @click="copyWebLink">复制链接</n-button>
            <n-button size="small" @click="openWebLink">浏览器</n-button>
            <n-button size="small" title="作废当前二维码，换一套会话" @click="refreshWeb">换会话</n-button>
          </div>
          <div class="web-hint">用二维码打开，不要手打地址。电脑上 Ctrl+Enter 把输入框发给浏览器；已连上 App 时两边一起发。</div>
          <img v-if="webQr" class="web-qr" :src="webQr" alt="兼容模式二维码" />
          <div v-else class="web-qr web-qr--empty">未启动。ts:// 不受影响。</div>
        </n-card>
      </n-modal>
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
import {
  headerWebVisible,
  headerWebRunning,
  setHeaderHandlers,
  clearHeaderHandlers,
} from "../js/headerNav"


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
const lanDiscover = ref(settings.getLanDiscover());
const lanPause = ref(settings.getLanDiscoverPause());
const lanAnnounce = ref(settings.getLanDiscoverAnnounce());
const lanFollow = ref(settings.getLanDiscoverPortFollow());
const lanPort = ref(settings.getLanDiscoverPort());
const lanPeers = ref([]);
const lanPaused = ref(false);
const lanBindError = ref("");
/** 客户端等待允许时，设备按钮上常驻的核对码。 */
const authSasByHost = ref({});
/** 正在等授权的地址。再点同一台只取消，界面立刻去掉「等待」。 */
const authBusyHost = ref("");
let authOp = 0;
const authPending = ref([]);
const aliveClients = ref([]);
const showAuthPanel = ref(false);
const showClientsPanel = ref(false);
const showSettings = ref(false);
const maxClients = ref(settings.getMaxClients());
const draftLanDiscover = ref(settings.getLanDiscover());
const draftLanPause = ref(settings.getLanDiscoverPause());
const draftLanAnnounce = ref(settings.getLanDiscoverAnnounce());
const draftLanFollow = ref(settings.getLanDiscoverPortFollow());
const draftLanPort = ref(settings.getLanDiscoverPort());
const sessionFocus = ref("auth");
const authIndex = ref(0);
const clientIndex = ref(0);
const draftMaxClients = ref(settings.getMaxClients());
const draftAuthRate = ref(settings.getAuthRatePerMin());
const draftAuthCool = ref(settings.getAuthCooldownSec());
const draftBlacklistItems = ref([]);
const draftBlacklistInput = ref("");
const draftBlacklistEditing = ref("");
const draftBlacklistVisible = computed(() =>
  draftBlacklistItems.value.filter((ip) => ip !== draftBlacklistEditing.value)
);
const lanPeerLabel = computed(() => {
  if (lanPaused.value) {
    return "已连接，探测已暂停";
  }
  if (lanBindError.value) {
    return lanBindError.value;
  }
  return lanPeers.value.length ? "局域网设备（点一下请求授权）" : "正在探测…还没看到其他 TextSend";
});

/** 和电脑端 / 安卓一样：探测进行中标题前一颗灯慢慢亮灭。 */
const lanProbing = computed(() =>
  !!lanDiscover.value && !lanPaused.value && !lanBindError.value
);

const lanPeerIdCounts = computed(() => {
  const counts = {};
  for (const p of lanPeers.value) {
    const id = p && p.idKey ? String(p.idKey) : "";
    if (!id) {
      continue;
    }
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
});

function lanPeerSameDevice(p) {
  const id = p && p.idKey ? String(p.idKey) : "";
  return !!(id && (lanPeerIdCounts.value[id] || 0) > 1);
}

function lanPeerText(p) {
  const base = `${p.name ? p.name + "  " : ""}${p.host}:${p.tcpPort}`;
  return lanPeerSameDevice(p) ? `${base}  （可能是同一设备）` : base;
}

function lanPeerTitle(p) {
  const sas = authSasByHost.value[p.host];
  if (sas) {
    return "核对码 " + sas + "。再点这一台取消申请";
  }
  if (lanPeerSameDevice(p)) {
    return "实例号相同，多半是同一进程的多网卡。点一下请求授权";
  }
  return "点一下：请求服务端临时授权（免输 PIN）；已有 PIN/密钥则直接连";
}

const pushLanState = () => {
  if (typeof window.syncLanDiscover !== "function") {
    return;
  }
  const connected = !!(mbStore.isConnected || mbStore.connectedCount > 0);
  const advertisePort = mbStore.serverMode && mbStore.isServerStart ? Number(tsStore.portNumber) || 0 : 0;
  const snap = window.syncLanDiscover({
    connected,
    connectedCount: mbStore.connectedCount,
    advertisePort,
    udpPort: lanPort.value,
  });
  lanPaused.value = !!(snap && snap.paused);
  lanBindError.value = snap && snap.bindError ? String(snap.bindError) : "";
  lanPeers.value = snap && Array.isArray(snap.peers) ? snap.peers : [];
  if (settings.getLanDiscoverPortFollow()) {
    lanPort.value = settings.getLanDiscoverPort();
    lanFollow.value = true;
  }
  if (typeof window.listLanAuthPending === "function") {
    const next = window.listLanAuthPending() || [];
    if (!authPending.value.length && next.length) {
      showClientsPanel.value = false;
      showAuthPanel.value = true;
      sessionFocus.value = "auth";
      window.$message && window.$message.info("有授权请求");
    }
    authPending.value = next;
    if (!next.length) {
      showAuthPanel.value = false;
    }
    if (authIndex.value >= next.length) {
      authIndex.value = 0;
    }
  }
  if (typeof window.listAliveClients === "function" && mbStore.serverMode && mbStore.isServerStart) {
    aliveClients.value = window.listAliveClients() || [];
    if (!aliveClients.value.length) {
      showClientsPanel.value = false;
    }
    if (clientIndex.value >= aliveClients.value.length) {
      clientIndex.value = 0;
    }
  } else {
    aliveClients.value = [];
    showClientsPanel.value = false;
  }
};

const onDraftLanDiscover = (checked) => {
  draftLanDiscover.value = !!checked;
};

const onDraftLanPause = (checked) => {
  draftLanPause.value = !!checked;
};

const onDraftLanAnnounce = (checked) => {
  draftLanAnnounce.value = !!checked;
};

const onDraftLanFollow = (checked) => {
  draftLanFollow.value = !!checked;
  if (checked) {
    draftLanPort.value = Number(tsStore.portNumber) || settings.getSavedListenPort();
  }
};

const openSettings = () => {
  draftLanDiscover.value = settings.getLanDiscover();
  draftLanPause.value = settings.getLanDiscoverPause();
  draftLanAnnounce.value = settings.getLanDiscoverAnnounce();
  draftLanFollow.value = settings.getLanDiscoverPortFollow();
  draftLanPort.value = settings.getLanDiscoverPort();
  draftMaxClients.value = settings.getMaxClients();
  draftAuthRate.value = settings.getAuthRatePerMin();
  draftAuthCool.value = settings.getAuthCooldownSec();
  const bl = String(settings.getAuthBlacklistText() || "")
    .split(/[,;\s]+/)
    .map((s) => normalizeBlacklistHost(s))
    .filter(Boolean);
  draftBlacklistItems.value = [...new Set(bl)];
  draftBlacklistInput.value = "";
  draftBlacklistEditing.value = "";
  showSettings.value = true;
};

function normalizeBlacklistHost(raw) {
  let h = String(raw || "").trim();
  if (h.startsWith("[") && h.endsWith("]") && h.length > 2) {
    h = h.slice(1, -1);
  }
  if (h.length > 7 && h.slice(0, 7).toLowerCase() === "::ffff:") {
    h = h.slice(7);
  }
  return h.toLowerCase();
}

function commitBlacklistInput() {
  const next = normalizeBlacklistHost(draftBlacklistInput.value);
  if (!next) {
    draftBlacklistEditing.value = "";
    draftBlacklistInput.value = "";
    return;
  }
  const edit = draftBlacklistEditing.value;
  let list = draftBlacklistItems.value.filter((ip) => ip !== edit && ip !== next);
  list.push(next);
  draftBlacklistItems.value = list;
  draftBlacklistEditing.value = "";
  draftBlacklistInput.value = "";
}

function startBlacklistEdit(ip) {
  draftBlacklistEditing.value = ip;
  draftBlacklistInput.value = ip;
}

function removeBlacklistItem(ip) {
  draftBlacklistItems.value = draftBlacklistItems.value.filter((x) => x !== ip);
  if (draftBlacklistEditing.value === ip) {
    draftBlacklistEditing.value = "";
    draftBlacklistInput.value = "";
  }
}

const saveSettings = () => {
  const portN = Number(draftLanPort.value);
  if (!draftLanFollow.value && (!Number.isFinite(portN) || portN < 1 || portN > 65535)) {
    window.$message && window.$message.error("探测端口须为 1–65535");
    return;
  }
  settings.setLanDiscoverAnnounce(!!draftLanAnnounce.value);
  settings.setLanDiscoverPortFollow(!!draftLanFollow.value);
  if (!draftLanFollow.value && !settings.setLanDiscoverPort(portN) && draftLanDiscover.value) {
    window.$message && window.$message.error("探测端口须为 1–65535");
    return;
  }
  if (!settings.setMaxClients(draftMaxClients.value)) {
    window.$message && window.$message.error("右键上限须为 1–64");
    return;
  }
  if (!settings.setAuthRatePerMin(draftAuthRate.value)) {
    window.$message && window.$message.error("授权限流须为 1–60");
    return;
  }
  if (!settings.setAuthCooldownSec(draftAuthCool.value)) {
    window.$message && window.$message.error("冷却秒数须为 0–86400");
    return;
  }
  commitBlacklistInput();
  settings.setAuthBlacklistText(draftBlacklistItems.value.join("\n"));
  settings.setLanDiscoverPause(!!draftLanPause.value);
  settings.setLanDiscover(!!draftLanDiscover.value);
  lanAnnounce.value = settings.getLanDiscoverAnnounce();
  lanFollow.value = settings.getLanDiscoverPortFollow();
  lanDiscover.value = settings.getLanDiscover();
  lanPause.value = settings.getLanDiscoverPause();
  lanPort.value = settings.getLanDiscoverPort();
  maxClients.value = settings.getMaxClients();
  // 保存后立刻套用：开/关探测、限流/冷却/黑名单；已开服则热更新人数上限
  if (typeof window.applyLanSettingsNow === "function") {
    const connected = !!(mbStore.isConnected || mbStore.connectedCount > 0);
    const advertisePort = mbStore.serverMode && mbStore.isServerStart ? Number(tsStore.portNumber) || 0 : 0;
    window.applyLanSettingsNow({
      connected,
      connectedCount: mbStore.connectedCount,
      advertisePort,
      udpPort: lanPort.value,
    });
  }
  if (mbStore.isServerStart) {
    mbStore.maxConnections = maxClients.value;
  }
  showSettings.value = false;
  pushLanState();
  window.$message && window.$message.success("设置已保存并生效");
};

const resetSettings = () => {
  if (typeof window.resetTextsendSettings !== "function") {
    return;
  }
  if (!window.confirm("探测、授权、端口、固定 PIN、记住的连接都会回到默认。正在运行的服务不中断，端口下次启动再生效。")) {
    return;
  }
  window.resetTextsendSettings();
  autoStartServer.value = settings.getAutoStartServer();
  customPinEnabled.value = settings.getCustomPinEnabled();
  customPinDraft.value = settings.getCustomPin();
  rememberClientConnection.value = settings.getRememberClientConnection();
  lanDiscover.value = settings.getLanDiscover();
  lanPause.value = settings.getLanDiscoverPause();
  lanAnnounce.value = settings.getLanDiscoverAnnounce();
  lanFollow.value = settings.getLanDiscoverPortFollow();
  lanPort.value = settings.getLanDiscoverPort();
  maxClients.value = settings.getMaxClients();
  tsStore.setPortNumberValue(settings.getSavedListenPort());
  showSettings.value = false;
  pushLanState();
  window.$message && window.$message.success("已恢复默认设置");
};

function onSessionKey(e) {
  const authOpen = showAuthPanel.value && authPending.value.length > 0;
  const clientsOpen = showClientsPanel.value && aliveClients.value.length > 0;
  if (!authOpen && !clientsOpen) {
    return;
  }
  const which = sessionFocus.value === "clients" && clientsOpen ? "clients" : (authOpen ? "auth" : "clients");
  const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (typing) {
      return;
    }
    const list = which === "auth" ? authPending.value : aliveClients.value;
    const idx = which === "auth" ? authIndex : clientIndex;
    if (!list.length) {
      return;
    }
    const step = e.key === "ArrowDown" ? 1 : list.length - 1;
    idx.value = (idx.value + step) % list.length;
    e.preventDefault();
    return;
  }
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
    return;
  }
  const key = String(e.key || "").toLowerCase();
  if ((key === "y" || key === "n") && which === "auth") {
    const row = authPending.value[authIndex.value];
    if (!row) {
      return;
    }
    e.preventDefault();
    onAuthDecide(row.host, key === "y" ? "allow" : "deny");
    return;
  }
  if (key === "b") {
    e.preventDefault();
    if (which === "auth") {
      const row = authPending.value[authIndex.value];
      if (row) {
        onAuthDecide(row.host, "blacklist");
      }
    } else {
      const row = aliveClients.value[clientIndex.value];
      if (row) {
        if (typeof window.decideLanAuth === "function") {
          window.decideLanAuth(row.host, "blacklist");
        }
        onKick(row.host);
      }
    }
    return;
  }
  if (key === "k" && which === "clients") {
    const row = aliveClients.value[clientIndex.value];
    if (!row) {
      return;
    }
    e.preventDefault();
    onKick(row.host);
  }
}

const openAuthDialog = () => {
  showClientsPanel.value = false;
  sessionFocus.value = "auth";
  showAuthPanel.value = true;
};

const openClientsDialog = () => {
  showAuthPanel.value = false;
  sessionFocus.value = "clients";
  showClientsPanel.value = true;
};

const onAuthDecide = (host, action) => {
  if (typeof window.decideLanAuth !== "function") {
    return;
  }
  const r = window.decideLanAuth(host, action);
  pushLanState();
  if (!r || !r.ok) {
    return;
  }
  if (r.action === "allow") {
    const tip = r.sas ? ("已允许 " + (r.name || host) + "（" + r.sas + "）") : ("已允许 " + (r.name || host));
    window.$message && window.$message.success(tip);
  } else if (r.action === "blacklist") {
    window.$message && window.$message.success("已拉黑 " + (r.name || host));
  } else {
    window.$message && window.$message.info("已拒绝 " + (r.name || host));
  }
};

const onAuthDenyAll = () => {
  if (typeof window.denyAllLanAuth === "function") {
    window.denyAllLanAuth();
  }
  pushLanState();
  window.$message && window.$message.info("已全部拒绝");
};

const onKick = (host) => {
  if (typeof window.kickClientHost === "function" && window.kickClientHost(host)) {
    window.$message && window.$message.success("已踢下线 " + host);
  }
  pushLanState();
};

const onKickAll = () => {
  if (typeof window.kickAllClients === "function") {
    window.kickAllClients();
  }
  pushLanState();
  window.$message && window.$message.success("已全部踢下线");
};

const onLanDiscoverChange = (checked) => {
  lanDiscover.value = !!checked;
  settings.setLanDiscover(checked);
  pushLanState();
};

const onLanPauseChange = (checked) => {
  lanPause.value = !!checked;
  settings.setLanDiscoverPause(checked);
  pushLanState();
};

const onLanPortChange = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    window.$message && window.$message.error("探测端口须为 1–65535");
    lanPort.value = settings.getLanDiscoverPort();
    return;
  }
  lanPort.value = n;
  settings.setLanDiscoverPort(n);
  pushLanState();
};

const applyLanPeer = async (peer) => {
  if (!peer || mbStore.serverMode || mbStore.isConnected) {
    return;
  }
  const cur = String(tsStore.inputText || "").trim();
  const first = cur.split(/\r?\n/, 1)[0].trim();
  let key = "";
  const m = first.match(/\/k(\S+)/);
  if (m && m[1] && m[1].length >= 8) {
    key = m[1];
  } else if (settings.getRememberClientConnection()) {
    const saved = settings.formatSavedClientRaw();
    const sm = String(saved || "").match(/\/k(\S+)/);
    if (sm) {
      key = sm[1];
    }
  }
  const host = String(peer.host).includes(":") ? "[" + peer.host + "]" : peer.host;
  if (key) {
    tsStore.setInputValueSync("ts://" + host + ":" + peer.tcpPort + "/k" + key);
    window.$message && window.$message.success("正在连接 " + host);
    mbStore.clientStart(tsStore.inputText);
    return;
  }
  if (!lanDiscover.value) {
    window.$message && window.$message.error("请先打开局域网探测");
    return;
  }
  if (typeof window.requestLanAuthConnect !== "function") {
    window.$message && window.$message.error("当前版本不支持临时授权");
    return;
  }
  const hostKey = String(peer.host || "");
  if (authBusyHost.value && authBusyHost.value === hostKey) {
    authOp += 1;
    if (typeof window.cancelLanAuth === "function") {
      window.cancelLanAuth();
    }
    clearAuthWait(hostKey);
    window.$message && window.$message.info("已取消授权申请");
    return;
  }
  if (authBusyHost.value) {
    window.$message && window.$message.info("正在等另一台授权");
    return;
  }
  const op = ++authOp;
  authBusyHost.value = hostKey;
  window.$message && window.$message.info("正在请求授权…");
  try {
    const uri = await window.requestLanAuthConnect(peer.host, peer.tcpPort, (code) => {
      if (op !== authOp || !code) {
        return;
      }
      authSasByHost.value = { ...authSasByHost.value, [hostKey]: String(code) };
    });
    if (op !== authOp) {
      return;
    }
    clearAuthWait(hostKey);
    tsStore.setInputValueSync(uri);
    window.$message && window.$message.success("已获授权，正在连接");
    mbStore.clientStart(uri);
  } catch (e) {
    if (op !== authOp) {
      return;
    }
    clearAuthWait(hostKey);
    const msg = String(e && e.message ? e.message : e);
    if (e && (e.code === "cancelled" || msg.indexOf("已取消") >= 0)) {
      window.$message && window.$message.info("已取消授权申请");
    } else {
      window.$message && window.$message.error(msg);
    }
  }
};

function clearAuthWait(hostKey) {
  if (authBusyHost.value === hostKey) {
    authBusyHost.value = "";
  }
  if (!hostKey || !authSasByHost.value[hostKey]) {
    return;
  }
  const next = { ...authSasByHost.value };
  delete next[hostKey];
  authSasByHost.value = next;
}

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
        mbStore.serverStart(tsStore.portNumber, settings.getMaxClients());
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
const webSessionUp = () => mbStore.serverMode
  && typeof window.webBridgeHasSession === "function"
  && window.webBridgeHasSession();

const canDeliver = () => mbStore.isConnected || webSessionUp();

const sendCurrentText = async () => {
  const text = tsStore.inputText;
  if (!text || !String(text).trim() || !canDeliver()) {
    return;
  }
  if (!mbStore.serverMode) {
    window.clientSend(text);
    return;
  }
  let delivered = 0;
  if (mbStore.isConnected) {
    try {
      const n = Number(await window.serverSend(text)) || 0;
      if (n > 0) {
        delivered += n;
      }
    } catch (e) {
      /* 网页桥还能发 */
    }
  }
  if (webSessionUp() && typeof window.webPushText === "function") {
    const w = Number(window.webPushText(text)) || 0;
    if (w > 0) {
      delivered++;
    } else if (delivered === 0 && w < 0) {
      window.$message && window.$message.error("文字超过 64KB");
      return;
    }
  }
  if (delivered > 0) {
    if (tsStore.inputText === text) {
      tsStore.setInputValueSync("");
    }
  } else {
    window.$message && window.$message.error(webSessionUp() ? "兼容模式会话已过期" : "没有已连接的客户端");
  }
}

const sendSmart = async () => {
  if (pastePreview.value) {
    await sendPastePreview();
    return;
  }
  if (queueItems.value.length) {
    if (!canDeliver()) {
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
let lanTimer = null;

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

const webHint = computed(() => {
  if (webWay.value === "A") {
    return "明文，靠扫码令牌。不要传密码。";
  }
  if (webWay.value === "C") {
    return "HTTPS，正文仍加密。根证书可选，不装时浏览器会提示不受信任。";
  }
  return "正文加密。三档同时只开一个。";
});

const webState = computed(() => {
  if (!webRunning.value) {
    return "未启动。ts:// 不受影响。";
  }
  const way = (typeof window.webBridgeWay === "function" && window.webBridgeWay()) || webWay.value;
  const port = (typeof window.webBridgePort === "function" && window.webBridgePort()) || webPort.value;
  if (!webUrl.value) {
    return "网页 " + way + "  0.0.0.0:" + port + "  ·  会话已过期";
  }
  return "网页 " + way + "  0.0.0.0:" + port + "  ·  浏览器 " + webListeners.value;
});

const onWebPort = (value) => {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 1 && n <= 65535) {
    webPort.value = n;
  }
};

const syncHeaderNav = () => {
  headerWebRunning.value = !!webRunning.value;
  headerWebVisible.value = !!(mbStore.serverMode || webRunning.value);
};

const refreshWebUi = () => {
  const running = typeof window.webBridgeRunning === "function" && !!window.webBridgeRunning();
  webRunning.value = running;
  syncHeaderNav();
  if (!showWeb.value && !running) {
    return;
  }
  const hosts = running && typeof window.webBridgeListeners === "function" ? window.webBridgeListeners() : [];
  webListeners.value = Array.isArray(hosts) ? hosts.length : 0;
  const host = tsStore.ipAddr || "127.0.0.1";
  const url = running && typeof window.webBridgePageUrl === "function" ? (window.webBridgePageUrl(host) || "") : "";
  if (url !== webUrl.value) {
    webUrl.value = url;
    webQr.value = "";
    if (url) {
      ensureLinkQrImg(url, (src) => {
        if (webUrl.value === url) {
          webQr.value = src || "";
        }
      });
    }
  }
};

const openWebBridge = () => {
  if (typeof window.webBridgeRunning === "function" && window.webBridgeRunning()) {
    const w = window.webBridgeWay && window.webBridgeWay();
    const p = window.webBridgePort && window.webBridgePort();
    if (w === "A" || w === "B" || w === "C") {
      webWay.value = w;
    }
    if (p >= 1 && p <= 65535) {
      webPort.value = p;
    }
  }
  showWeb.value = true;
  refreshWebUi();
};

const toggleWebBridge = async () => {
  if (webRunning.value) {
    if (typeof window.stopWebBridge === "function") {
      await window.stopWebBridge();
    }
    refreshWebUi();
    return;
  }
  const p = Number(webPort.value);
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    window.$message && window.$message.error("端口无效");
    return;
  }
  const err = await window.startWebBridge(p, webWay.value);
  if (err) {
    window.$message && window.$message.error(String(err));
  }
  refreshWebUi();
};

const copyWebLink = () => {
  if (!webUrl.value) {
    window.$message && window.$message.info("先启动，再复制链接");
    return;
  }
  if (typeof window.copyText === "function") {
    window.copyText(webUrl.value);
  }
  window.$message && window.$message.success("已复制链接");
};

const openWebLink = () => {
  if (!webUrl.value) {
    window.$message && window.$message.info("先启动，再打开链接");
    return;
  }
  openExternalUrl(webUrl.value);
};

const revealWebCa = () => {
  const runningC = webRunning.value && typeof window.webBridgeWay === "function" && window.webBridgeWay() === "C";
  if (!runningC) {
    window.$message && window.$message.info("先用 C 档启动");
    return;
  }
  const p = typeof window.webBridgeRevealCa === "function" ? window.webBridgeRevealCa() : "";
  if (!p) {
    window.$message && window.$message.error("还没有根证书");
    return;
  }
  if (typeof window.copyText === "function") {
    window.copyText(p);
  }
  window.$message && window.$message.success("根证书：" + p);
};

const refreshWeb = () => {
  if (!webRunning.value || typeof window.refreshWebSession !== "function") {
    window.$message && window.$message.info("先启动");
    return;
  }
  window.refreshWebSession();
  webUrl.value = "";
  refreshWebUi();
  window.$message && window.$message.success("已换一套会话，请重新扫码");
};

const pollFile = () => {
  refreshWebUi();
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
  if (!canDeliver()) {
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

const applyPendingTsUri = async (uri) => {
  const raw = String(uri || "").trim();
  if (!raw) {
    return;
  }
  try {
    if (mbStore.isConnected && !mbStore.serverMode) {
      await mbStore.clientStop();
    }
    if (mbStore.serverMode && mbStore.isServerStart) {
      await mbStore.serverStop();
    }
    if (mbStore.serverMode) {
      mbStore.changeServerMode();
    }
    tsStore.setInputValueSync(raw);
    window.$message && window.$message.success("已识别连接串，正在连接…");
    mbStore.clientStart(raw);
  } catch (e) {
    window.$message && window.$message.error(String(e && e.message ? e.message : e));
  }
};

const onPendingTsUriEvent = (ev) => {
  const uri = ev && ev.detail ? String(ev.detail) : "";
  if (uri) {
    applyPendingTsUri(uri);
    if (typeof window.consumePendingTsUri === "function") {
      window.consumePendingTsUri();
    }
  }
};

const tryConsumePendingTsUri = () => {
  if (typeof window.consumePendingTsUri !== "function") {
    return;
  }
  const uri = window.consumePendingTsUri();
  if (uri) {
    applyPendingTsUri(uri);
  }
};

onMounted(() => {
  setHeaderHandlers({
    web: () => openWebBridge(),
    help: () => btnHelp(),
    about: () => btnAbout(),
  });
  syncHeaderNav();
  pollFile();
  pushLanState();
  fileTimer = setInterval(pollFile, 250);
  lanTimer = setInterval(pushLanState, 1000);
  window.addEventListener("textsend-pending-uri", onPendingTsUriEvent);
  window.addEventListener("keydown", onSessionKey);
  const hasPendingUri = typeof window.peekPendingTsUri === "function" && !!window.peekPendingTsUri();
  // 稍后再取：等界面就绪；有连接串时本轮不自动开服
  setTimeout(tryConsumePendingTsUri, 80);
  if (!hasPendingUri && !autoStartLaunched && mbStore.serverMode && autoStartServer.value && !mbStore.isServerStart) {
    autoStartLaunched = true;
    mbStore.serverStart(tsStore.portNumber, 1);
  }
});
onUnmounted(() => {
  clearHeaderHandlers();
  headerWebVisible.value = false;
  headerWebRunning.value = false;
  window.removeEventListener("textsend-pending-uri", onPendingTsUriEvent);
  window.removeEventListener("keydown", onSessionKey);
  if (fileTimer) {
    clearInterval(fileTimer);
    fileTimer = null;
  }
  if (lanTimer) {
    clearInterval(lanTimer);
    lanTimer = null;
  }
  if (typeof window.stopLanDiscover === "function") {
    window.stopLanDiscover();
  }
});

watch(
  () => [mbStore.isConnected, mbStore.connectedCount, mbStore.isServerStart, mbStore.serverMode, tsStore.portNumber],
  () => {
    syncHeaderNav();
    pushLanState();
  }
);

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
const showWeb = ref(false);
const webWay = ref("B");
const webPort = ref(54301);
const webRunning = ref(false);
const webUrl = ref("");
const webQr = ref("");
const webListeners = ref(0);
const helpText = `TextSend uTools  ·  局域网即时投送  ·  ${mbStore.version}

—— 按钮 ——
· 「启动」左键：最多 1 人。右键：最多 N 人（设置里改，默认 7）。再点是停止。
· 「发送」：有图片预览先发图；有待发就发文件；否则发输入框里的文字。
· 「文件」左键选文件；右键或 Shift+左键选文件夹。选完先进待发，点「发送」才传。
· 「取消」：停这一轮。待发还在。
· 「清空」：清掉待发列表，不影响正在传的。
· 「切换」：服务端 / 客户端。客户端粘贴 ts:// 后点「连接」。
· 顶栏「待授权」「已连接」：点开是对话框。先对核对码，再允许 / 拒绝 / 拉黑。对话框打开时 Alt+Y 允许、Alt+N 拒绝、Alt+B 拉黑、Alt+K 踢下线，↑↓ 换蓝框那一台。客户端再点同一台设备取消申请。
· 「设置」：探测、主动广播、探测口跟随连接口、限流、冷却、黑名单、右键启动人数。
· 顶栏「帮助」：本页。「关于」：版本和手机端下载。
· 顶栏「兼容模式」：给浏览器。A 明文、B 加密、C 证书，端口默认 54301，和 ts:// 的 54300 分开，同时只开一档。C 可下根证书。有 App 客户端时文字和文件两边都发；只有网页会话时 Ctrl+Enter 发给浏览器。

—— 连上 ——
· 选好本机局域网 IP 和端口，点「启动」。左侧出现二维码和 PIN。
· 可勾选「启动即开服」 / 「固定 PIN」（默认关）。
· 点「切换」到客户端：粘贴 ts://IP/kPIN（端口可省略），再点「连接」。
· 也可在 uTools 主搜索框直接粘贴 ts://… ，选「用 TextSend 连接」会自动打开并连接。
· 「局域网探测」（默认关）：点设备请求临时授权（免输 PIN，须对方在「待授权」允许）。两边会显示同一串核对码，对得上再允许。再点同一台取消。
· 连接和探测默认都用 54300，探测口默认跟着连接端口。连接和授权是 TCP，发现设备是 UDP。防火墙若只放了 TCP，还要放行 UDP 54300。「有连接时关闭」默认开，「主动广播」默认开。

—— 待授权 / 已连接 / 设置 ——
· 顶栏点「待授权」「已连接」打开对话框，再允许 / 拒绝 / 拉黑，或踢下线。
· 「设置」：右键启动上限、授权限流（默认 3 次/分·IP）、拒绝冷却（默认 10 秒）、黑名单。

—— 左键 / 右键不一样 ——
· 「启动」左键最多 1 人；右键最多 N 人（N 在设置，默认 7）。
· 「文件」左键选文件；右键/Shift+左键选文件夹。

—— 文字 / 文件 ——
· 「发送」：有预览先发图，有待发发文件，否则发文字。对面落到「下载/TextSend」。

—— 其他端 ——
· Android APK：点「关于」→ 悬停 GitHub / Gitee 看二维码。`;
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

.session-btns {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.session-btns + .inbox-btn {
  margin-left: 0;
}

.session-card {
  width: min(480px, 92vw);
}

.web-card {
  width: min(420px, 92vw);
}

.web-ways {
  display: flex;
  gap: 6px;
}

.web-chip {
  flex: 1;
  height: 32px;
  border-radius: 10px;
  border: 1.5px solid var(--ts-accent);
  background: transparent;
  color: var(--ts-accent);
  cursor: pointer;
  font-size: 13px;
}

.web-chip.on {
  background: var(--ts-accent);
  color: #fff;
}

.web-hint {
  margin: 8px 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ts-muted);
}

.web-port {
  width: 100%;
  margin-bottom: 8px;
}

.web-go {
  width: 100%;
}

.web-side {
  margin-top: 8px;
}

.web-state {
  margin-top: 8px;
  font-size: 12px;
  color: var(--ts-ink);
}

.web-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.web-qr {
  display: block;
  width: 196px;
  height: 196px;
  margin: 10px auto 0;
  object-fit: contain;
  background: #fff;
}

.web-qr--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--ts-muted);
  text-align: center;
  padding: 12px;
  box-sizing: border-box;
}

.session-empty {
  font-size: 13px;
  color: var(--ts-muted);
  padding: 8px 0 4px;
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
  justify-content: flex-start;
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

.lan-peers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 0 2px 6px;
}

.lan-peers-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.lan-probe-light {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #3d7eff;
  flex: 0 0 auto;
  animation: lan-probe-breath 1.7s ease-in-out infinite;
}

@keyframes lan-probe-breath {
  0%,
  100% {
    opacity: 0.15;
  }
  50% {
    opacity: 1;
  }
}

.lan-peers-label {
  font-size: 12px;
  color: var(--ts-muted);
}

.lan-peer {
  border: 1px solid var(--ts-line);
  background: var(--ts-surface);
  color: inherit;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
}

.lan-peer--sas {
  border-radius: 6px;
  padding: 4px 8px;
}

.lan-peer-sas {
  font-size: 11px;
  color: var(--ts-muted);
  font-weight: normal;
}

.lan-peer--entry {
  border-radius: 6px;
}

.auth-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0 2px;
}

.auth-row {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  padding: 4px;
}

.auth-name {
  flex: 1;
  min-width: 0;
}

.auth-host {
  font-size: 12px;
  color: var(--ts-muted);
}

.auth-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.auth-row--on {
  outline: 1px solid #3b6cff;
  border-radius: 4px;
}

.auth-keys {
  font-size: 11px;
  color: var(--ts-muted);
  padding: 0 2px 2px;
}

.auth-btn {
  border: 1px solid var(--ts-line);
  background: var(--ts-chip);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
}

.auth-btn--all {
  align-self: flex-end;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.settings-row :deep(.n-input-number) {
  width: 88px;
}

.settings-bl-title {
  font-size: 13px;
  margin-bottom: 6px;
}

.settings-bl-list {
  display: flex;
  flex-direction: column;
  height: 140px;
  overflow-x: hidden;
  overflow-y: auto;
  margin-bottom: 6px;
  border: 1px solid var(--ts-line);
  background: var(--ts-surface);
  box-sizing: border-box;
}

.settings-bl-empty {
  font-size: 12px;
  color: var(--ts-muted);
  padding: 6px 10px;
}

.settings-bl-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 28px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--ts-line);
}

.settings-bl-ip {
  flex: 1;
  min-width: 0;
  text-align: left;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.settings-bl-del {
  flex: 0 0 36px;
  align-self: stretch;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.settings-bl-tip {
  font-size: 11px;
  color: var(--ts-muted);
  margin-top: 4px;
}

.settings-hint {
  font-size: 12px;
  color: var(--ts-muted);
  line-height: 1.45;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.lan-port-input {
  width: 72px;
}

.lan-on-hint {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--ts-accent, #18a058);
  white-space: nowrap;
}

.settings-form :deep(.n-checkbox) {
  align-self: flex-start;
}
</style>


