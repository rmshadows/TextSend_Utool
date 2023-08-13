<template>
  <div class="textsend-component">
    <!-- 文本框 -->
    <div class="input">
      <div class="input-padding-div">
        <!-- 下面div有多大，文本输入框就有多大 -->
        <div class="input-div">
          <n-input class="input-textarea" @input="inputOnInput" @change="inputOnChange" :value="inputText" type="textarea"
            :clearable=true :placeholder="placeholder" show-count @update-value="inputOnUpdate" :loading="isLoading" />
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
          名称：{{ this.$store.state.mainbodydata.appName }}
          <br>
          作者：{{ this.$store.state.mainbodydata.author }}
          <br>
          版本：{{ this.$store.state.mainbodydata.version }}
        </n-card>
      </n-modal>
    </div>
  </div>
</template>

<script setup>
import { NInput, NButton, NSelect, NInputNumber, NTooltip, NCard, NModal } from "naive-ui";
import { ref, reactive, computed } from "vue"
import { useStore } from 'vuex'

// 定义函数
// 文本框
// 更新文本框
const inputOnUpdate = async (value) => {
  // 使用Action
  // store.dispatch('textsenddata/setInputValue', value);
  // Promise
  store.dispatch('textsenddata/setIsLoadingValue', true)
    .then(() => { store.dispatch('textsenddata/setInputValue', value) })
    .then(() => { store.dispatch('textsenddata/setIsLoadingValue', false) });
  // 使用Mutation
  // store.commit("textsenddata/setInputValue", value);
}

// 先Update后OnInput最后onChange
const inputOnInput = (value) => {

}

// change是最后调用的
const inputOnChange = (value) => {

}

// 选择框
/**
 * 更新IP地址列表(选择框)
 */
const getIpAddrList = () => {
  // TODO:DEBUG
  // let ips = window.getIpAddr();
  // let ipA = [];
  // for (let i = 0; i < ips.length; i++) {
  //   let seel = { label: ips[i], value: ips[i] }
  //   ipA.push(seel);
  // }
  // console.log("返回IP列表:" + ipA);
  // return ipA;
  return [{
    "label": "127.0.0.1",
    "value": "127.0.0.1"
  },
  {
    "label": "::a",
    "value": "::a"
  },
  {
    "label": "::b",
    "value": "::b"
  },
  {
    "label": "192.168.30.126",
    "value": "192.168.30.126"
  }];
}
/**
 * 配置默认的IP
 * @param {ref {IP数组} array 
 */
const getDefaultIpAddr = (array) => {
  // 先查找192.168.1
  for (let i = 0; i < array.length; i++) {  //遍历数组
    if (String(array[i].value).includes("192.168.1.")) {
      return array[i].value;
    }
  }
  // 再查找192.168
  for (let i = 0; i < array.length; i++) {
    if (array[i].value.includes("192.168.")) {
      console.log("返回默认IP:" + array[i].value);
      return array[i].value;
    }
  }
  return "127.0.0.1";
}
/**
 * 更新IP列表
 */
const updateIpAddrList = () => {
  store.commit("textsenddata/setIpAddrListValue", getIpAddrList());
}
/**
 * 当选择IP内容变动
value: "192.168.30.126"
option: {"label":"192.168.30.126","value":"192.168.30.126"}
 * @param {*} value 
 * @param {*} option 
 */
const selectOnUpdateValue = (value, option) => {
  store.commit("textsenddata/setIpAddrValue", value);
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
  store.commit("textsenddata/setPortNumberValue", value);
}


/**
 * 下面是按钮事件
 */
const btnLaunch = () => {
  // TODO : DEBUG
  // store.getters['textsenddata/getInputTextPlaceholder'];
  // 如果是服务端模式
  if (store.state.mainbodydata.serverMode) {
    // 如果服务启动状态
    if (store.state.mainbodydata.isServerStart) {
      // 更改为服务停止
      // TODO：停止Socket （状态在方法在设置）
      // store.commit('mainbodydata/setServerStat', false);
      // store.commit('mainbodydata/setConnectedStat', false);
    } else {
      // TODO:启动Socket
      // store.commit('mainbodydata/setServerStat', true);
    }
  } else {
    // 客户端模式
    // 如果是连接状态
    if (store.state.mainbodydata.isConnected) {
      // TODO：断开链接（状态在方法在设置）
      // store.commit('mainbodydata/setServerStat', false);
      // store.commit('mainbodydata/setConnectedStat', false);
    } else {
      // TODO:链接服务端
      // store.commit('mainbodydata/setServerStat', true);
    }
  }
}
const btnChangeMode = () => {
  if (store.state.mainbodydata.isServerStart) {
    // 如果服务模式启动，禁用切换按钮
    console.log("服务启动，禁止切换模式");
  } else {
    // 如果服务模式停止，启用切换按钮
    if (store.state.mainbodydata.isConnected) {
      // 链接状态，可发送文字
      // TODO: 发送文字
    } else {
      // 如果未连接状态，可切换模式
      store.commit('mainbodydata/changeServerMode');
    }
  }

}
const btnAbout = () => {
  showModal.value = true;
}

/**
 *  定义变量 
 */
// 已使用vuex代替父传子
// const props = defineProps(['serverMode']);
// console.log(props.serverMode);

const emit = defineEmits(['']);
// 使用vuex
const store = useStore();
// 文本框输入的文字
// let inputText = ref("");
let inputText = computed(() => store.state.textsenddata.inputText);
let isLoading = computed(() => store.state.textsenddata.isLoading);
// IP列表
let ipAddrList = computed(() => store.state.textsenddata.ipAddrList);
// IP地址
// let ipAddr = ref(setDefaultIpAddr(ipAddrList));
let ipAddr = computed(() => store.state.textsenddata.ipAddr);
// 默认端口
let portNumber = computed(() => store.state.textsenddata.portNumber);
// 是否显示About内容
let showModal = ref(false);
// 文本框默认字
// let placeholder = ref("请输入要发送的文字");
let placeholder = computed(() => store.getters['textsenddata/getInputTextPlaceholder']);
// let launchBtnText = computed(() => store.state.textsenddata.launchBtnText);
let launchBtnText = computed(() => store.getters['textsenddata/getLaunchBtnText']);
// let changeModeBtnText = computed(() => store.state.textsenddata.changeModeBtnText);
let changeModeBtnText = computed(() => store.getters['textsenddata/getChangeModeBtnText']);
let changeModeBtnStat = computed(() => store.state.mainbodydata.disableChangeModeBtn);

// 初始化
updateIpAddrList();
store.commit("textsenddata/setIpAddrValue", getDefaultIpAddr(store.state.textsenddata.ipAddrList));
console.log("Init: " + JSON.stringify(store.state.textsenddata.ipAddrList));
console.log("Init: " + store.state.textsenddata.ipAddr);
console.log("Init: " + store.state.textsenddata.portNumber);
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


