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
      <n-button size="large" class="button" @click="btnLaunch">
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
import { ref, reactive, computed } from "vue"
import { useTextsendStore } from '../stores/textsendStore'
import { useMainbodyStore } from '../stores/mainbodyStore'
import { useQrStore } from '../stores/qrStore'
import * as js from "../js/tsc"

// 可以在组件中的任意位置访问 `store` 变量 ✨
const tsStore = useTextsendStore();
const mbStore = useMainbodyStore();
const qrStore = useQrStore();

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
 * 下面是按钮事件
 */
const btnLaunch = () => {
  // 如果是服务端模式
  if (mbStore.serverMode) {
    // 如果服务启动状态
    if (mbStore.isServerStart) {
      // 停止Socket （更改为服务停止:状态在方法在设置）
      mbStore.serverStop();
      qrStore.setQrImgDefaultValue();
    } else {
      // 启动Socket
      mbStore.serverStart(tsStore.portNumber);
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
      // TODO：断开链接（状态在方法在设置）
    } else {
      // TODO:链接服务端

    }
  }
}
const btnChangeMode = () => {
  if (mbStore.isServerStart) {
    // 如果服务模式启动，禁用切换按钮
    console.log("服务启动，禁止切换模式");
  } else {
    // 如果服务模式停止，启用切换按钮
    if (mbStore.isConnected) {
      // 链接状态，可发送文字
      // TODO: 发送文字
    } else {
      // 如果未连接状态，可切换模式
      mbStore.changeServerMode();
    }
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


