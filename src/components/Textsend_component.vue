<template>
  <div class="textsend-component">
    <!-- 文本框 -->
    <div class="input">
      <div class="input-padding-div">
        <!-- 下面div有多大，文本输入框就有多大 -->
        <div class="input-div">
          <n-input class="input-textarea" @input="inputOnInput" @change="inputOnChange" :value="inputText" type="textarea"
            :clearable=true :placeholder="placeholder" show-count @update-value="inputOnUpdate" autofocus="true"
            :loading="isLoading" />
        </div>
      </div>
    </div>

    <div class="buttons">
      <!-- 选择IP -->
      <span class="select-span">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-select :value="ipAddr" :options="ipAddrList" size="large" @update:value="selectOnUpdateValue"
              @update-show="updateIpAddrList" />
          </template>
          请选择本机IP
        </n-tooltip>
      </span>
      <!-- 选择端口 -->
      <span class="input-span">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-input-number :value="portNumber" :validator="portNumberValidator" size="large" :max=65535 placeholder="端口号"
              :format="portNumberFormator" @update-value="inputNumberUpdate" />
            <!-- 因为已经使用vuex赋值了，所以不能再用v-model，否则：Write operation failed: computed value is readonly -->
            <!-- <n-input-number v-model:value="portNumber" :validator="portNumberValidator" size="large" :max=65535
              placeholder="端口号" :format="portNumberFormator" @update-value="inputNumberUpdate" /> -->
          </template>
          默认是 54300 端口。
        </n-tooltip>
      </span>
      <!-- 按钮组 -->
      <n-button size="large" class="button" @click="btnLaunch" @contextmenu="btnLaunchContextMenu">
        <span v-html="launchBtnText"></span></n-button>
      <n-button size="large" class="button" @click="btnChangeMode" :disabled="changeModeBtnStat">
        <span v-html="changeModeBtnText"></span></n-button>
      <n-button size="large" class="button" @click="btnAbout"><span> 关&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;于 </span></n-button>
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
      // 生成二维码 并修改二维码图片
      let qrpath = js.UupdateQrImgPath(tsStore.ipAddr, tsStore.portNumber);
      // 等待二维码生成再更改图片
      setTimeout(() => {
        qrStore.setQrImgValue(qrpath);
      }, 500);
    }
  } else {
    // 客户端模式
    // 如果是连接状态
    if (mbStore.isConnected) {
      // 断开链接
      mbStore.clientStop();
    } else {
      // 链接服务端
      // 获取IP
      let addr = tsStore.inputText;
      let i = undefined;
      let p = undefined;
      // 先判是否是ipv6
      if (js.UisIpv6(addr)) {
        // 如果是ipv6
        if (addr.indexOf("]") == -1) {
          // 如果没有括号，表示不带端口
          p = 54300;
          i = tsStore.inputText;
        } else {
          addr = addr.split("]:");
          // 去除前面中括号
          i = addr[0].replace("[", "");
          p = addr[1];
        }  
      } else {
        if (addr.indexOf(":") == -1) {
          // 没有端口号
          p = 54300;
          i = tsStore.inputText;
        } else {
          addr = addr.split(":");
          i = addr[0];
          p = addr[1];
        }
      }
      mbStore.clientStart(i, p);
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
const btnChangeMode = () => {
  /**
   * 1.切换模式
   * 2.服务端发送
   * 3.客户端发送
   */
  if (mbStore.disableChangeModeBtn) {
    console.log("按钮已禁用。");
  } else if (mbStore.serverMode && mbStore.isConnected) {
    // 服务端模式 且已连接
    // console.log("Server send message.");
    window.serverSend(tsStore.inputText);
  } else if (!mbStore.serverMode && mbStore.isConnected) {
    // 客户端模式 且已连接
    // console.log("Client send msg.");
    window.clientSend(tsStore.inputText);
  } else {
    mbStore.changeServerMode();
  }
}
const btnAbout = () => {
  showModal.value = true;
}

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
let showError = computed(() => tsStore.showError);




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
// 总体
.textsend-component {
  height: 100%;
  width: 100%;
}

// 上:输入框部分div 9/10
.input {
  height: 90%;

  .input-padding-div {
    padding: 40px;
    box-sizing: border-box;
    height: 100%;
  }

  .input-div {
    // height: calc((100% - 2*20px));
    height: 100%;
  }

  // 输入框
  .input-textarea {
    height: 100%;
    font-size: 33px;
  }
}

// 下:按钮部分div 1/10
.buttons {
  width: 100%;
  height: 10%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;

  // 选择框span
  .select-span {
    width: 200px;
    text-align: center;
  }

  // 文本框span
  .input-span {
    width: 130px;
    text-align: center;
  }

  // 按钮
  .button {
    font-size: 20px;
  }
}
</style>


