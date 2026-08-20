<template>
  <div class="textsend-component">
    <!-- 文本框 -->
    <div class="input">
      <div class="input-padding-div">
        <!-- 下面div有多大，文本输入框就有多大 -->
        <div class="input-div">
          <n-input class="input-textarea" @input="inputOnInput" @change="inputOnChange" :value="inputText" type="textarea"
            :clearable=true :placeholder="placeholder" show-count @update-value="inputOnUpdate" autofocus="true"
            :loading="isLoading" @keydown="onInputKeydown" />
        </div>
      </div>
    </div>

    <div class="buttons">
      <!-- 选择IP -->
      <span class="select-span">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-select :value="ipAddr" :options="ipAddrList" size="medium" @update:value="selectOnUpdateValue"
              @update-show="updateIpAddrList" />
          </template>
          请选择本机IP
        </n-tooltip>
      </span>
      <!-- PIN（服务端运行中，点复制 PIN 连接串） -->
      <span v-if="pinText" class="pin-span" @click="copyPinUri" @contextmenu.prevent="copyPinOnly">
        PIN {{ pinText }}
      </span>
      <span v-if="showClientCount" class="count-span" title="已握手的客户端数">{{ clientCountLabel }}</span>
      <span class="input-span">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-input-number :value="portNumber" :validator="portNumberValidator" size="medium" :max=65535 placeholder="端口号"
              :format="portNumberFormator" @update-value="inputNumberUpdate" />
            <!-- 因为已经使用vuex赋值了，所以不能再用v-model，否则：Write operation failed: computed value is readonly -->
            <!-- <n-input-number v-model:value="portNumber" :validator="portNumberValidator" size="large" :max=65535
              placeholder="端口号" :format="portNumberFormator" @update-value="inputNumberUpdate" /> -->
          </template>
          默认是 54300 端口。
        </n-tooltip>
      </span>
      <!-- 按钮组 -->
      <n-button size="medium" class="button" @click="btnLaunch" @contextmenu="btnLaunchContextMenu">
        <span v-html="launchBtnText"></span></n-button>
      <n-button size="medium" class="button" @click="btnChangeMode" :disabled="changeModeBtnStat">
        <span v-html="changeModeBtnText"></span></n-button>
      <n-button size="medium" class="button" @click="btnAbout"><span> 关&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;于 </span></n-button>
      <!-- About弹出框 -->
      <n-modal v-model:show="showModal">
        <n-card style="width: 600px" title="About" :bordered="false" size="huge" role="dialog" aria-modal="true">
          名称：{{ mbStore.appName }}
          <br>
          作者：{{ mbStore.author }}
          <br>
          版本：{{ mbStore.version }}
        </n-card>
      </n-modal>
    </div>
  </div>
</template>

<script setup>
import { NInput, NButton, NSelect, NInputNumber, NTooltip, NCard, NModal } from "naive-ui";
import { ref, watch, reactive, computed } from "vue"
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
window.$message = useMessage();

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
  tsStore.setIpAddrListValue(js.UgetIpAddrList());
}
/**
 * 当选择IP内容变动
value: "192.168.30.126"
option: {"label":"192.168.30.126","value":"192.168.30.126"}
 * @param {*} value 
 * @param {*} option 
 */
const selectOnUpdateValue = (value, option) => {
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
      // 停止Socket （更改为服务停止:状态在方法在设置）
      mbStore.serverStop();
      qrStore.setQrImgDefaultValue();
    } else {
      // 启动Socket
      if (oneClient) {
        mbStore.serverStart(tsStore.portNumber, 1);
      } else {
        // 允许7个
        mbStore.serverStart(tsStore.portNumber, 7);
      }
      // 生成二维码（ts:// + 长密钥）
      refreshQr();
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

const onInputKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    sendCurrentText();
  }
}

const btnChangeMode = () => {
  if (mbStore.disableChangeModeBtn) {
    console.log("按钮已禁用。");
  } else if (mbStore.isConnected) {
    sendCurrentText();
  } else {
    mbStore.changeServerMode();
  }
}
const btnAbout = () => {
  showModal.value = true;
}

const refreshQr = () => {
  const psk = window.getPskB64 && window.getPskB64();
  const pin = window.getPin && window.getPin();
  qrStore.setPsk(psk);
  qrStore.setPin(pin);
  if (!psk) {
    return;
  }
  const uri = window.formatUri(tsStore.ipAddr, tsStore.portNumber, psk);
  const qrpath = js.UupdateQrImgPath(uri);
  setTimeout(() => {
    qrStore.setQrImgValue(qrpath);
  }, 200);
}

const copyPinUri = () => {
  const pin = qrStore.pin;
  if (!pin) {
    return;
  }
  window.copyText(window.formatUri(tsStore.ipAddr, tsStore.portNumber, pin));
  window.$message.success("已复制 PIN 连接串");
}

const copyPinOnly = () => {
  if (!qrStore.pin) {
    return;
  }
  window.copyText(qrStore.pin);
  window.$message.success("已复制 PIN");
}

watch(() => tsStore.ipAddr, () => {
  if (mbStore.isServerStart && qrStore.pskB64) {
    refreshQr();
  }
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
// 是否显示About内容
let showModal = ref(false);
// 文本框默认字
let placeholder = computed(() => tsStore.getInputTextPlaceholder);
let launchBtnText = computed(() => tsStore.getLaunchBtnText);
let changeModeBtnText = computed(() => tsStore.getChangeModeBtnText);
// 按钮状态
let changeModeBtnStat = computed(() => mbStore.getDisableChangeModeBtn);
let pinText = computed(() => qrStore.pin);
let showClientCount = computed(() => mbStore.serverMode && mbStore.isServerStart);
let clientCountLabel = computed(() => {
  const n = mbStore.connectedCount;
  const max = mbStore.maxConnections;
  return max > 1 ? `客户端 ${n}/${max}` : `客户端 ${n}`;
});




// IPC通信，未使用
// window.ping((event, value) => {
//   console.log("event" + "IPC Renderer: 接受Ping -> " + value);
// });

// 初始化
updateIpAddrList();
// 获取默认IP (仅在初始化时调用) 
tsStore.setIpAddrValue(js.getDefaultIpAddr(tsStore.ipAddrList));
console.log("Init: " + JSON.stringify(tsStore.ipAddrList));
console.log("Init: " + tsStore.ipAddr);
console.log("Init: " + tsStore.portNumber);
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
}

.input {
  flex: 1 1 auto;
  min-height: 0;

  .input-padding-div {
    padding: 12px 16px;
    box-sizing: border-box;
    height: 100%;
  }

  .input-div {
    height: 100%;
  }

  .input-textarea {
    height: 100%;
    font-size: 16px;
  }
}

.buttons {
  width: 100%;
  flex: 0 0 auto;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-around;
  gap: 6px;
  padding: 6px 8px;
  box-sizing: border-box;

  .select-span {
    width: 160px;
    max-width: 200px;
    flex: 1 1 140px;
    text-align: center;
  }

  .pin-span {
    min-width: 110px;
    text-align: center;
    cursor: pointer;
    user-select: all;
    font-size: 13px;
  }

  .count-span {
    min-width: 72px;
    text-align: center;
    user-select: none;
    font-size: 13px;
    opacity: 0.85;
  }

  .input-span {
    width: 110px;
    text-align: center;
  }

  .button {
    font-size: 14px;
  }
}
</style>


