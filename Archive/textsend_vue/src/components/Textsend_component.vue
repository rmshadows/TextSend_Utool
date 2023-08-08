<template>
  <div class="textsend-component">
    <div class="input">
      <div class="input-padding-div">
        <!-- 下面div有多大，文本输入框就有多大 -->
        <div class="input-div">
          <n-input class="input-textarea" v-model:value="value" type="textarea" clearable="true" placeholder="请输入要发送的文字"
            show-count />
        </div>
      </div>
    </div>

    <div class="buttons">
      <span class="select-span">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-select v-model:value="ipAddrInit" :options="ipAddrList" :size="large" :on-update-value="updateIpAddr" />
          </template>
          如果没有正确选择本机IP ，请手动指定。
        </n-tooltip>
      </span>
      <span class="input-span">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-input-number v-model:value="portNumber" :validator="portNumberValidator" :size="large" :max="65535"
              :placeholder="端口号" :format="portNumberFormator" :on-update-value="updatePort" />
          </template>
          默认是 54300 端口。 
        </n-tooltip>
      </span>
      <n-button size="large" class="button"><span> 启&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;动 </span></n-button>
      <n-button size="large" class="button"><span> 切&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;换 </span></n-button>
      <n-button size="large" class="button"><span> 关&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;于 </span></n-button>
    </div>
  </div>
</template>

<script setup>
import { NInput, NButton, NSelect, NInputNumber, NTooltip } from "naive-ui";
import { ref } from "vue";

// 默认值
const defaultValue = ref(" - ");
// 初始化IP
const ipAddrInit = ref("127.0.0.1");
// 默认端口
const portNumber = ref(54300);

// let ips = msystem.getIpAddr();
// console.log(ips);// TODO

const ipAddrList = ref([
  {
    label: "127.0.0.1",
    value: "127.0.0.1"
  }
]);

/**
 * 验证端口号是否合规 （要求大于0） 
 * @param {Number} x 
 */
const portNumberValidator = (x) => x > 0;

/**
 * 格式化为整数
 * @param {Number} value 
 */
const portNumberFormator = (value) => {
  if ((value % 1) != 0)
    return parseInt(value);
  return value;
}

/**
 * 更新IP地址
 * @param {String} x
 */
const updateIpAddr = (x) => {
  console.log(x);
};

/**
 * 更新端口号
 * @param {Number} x
 */
const updatePort = (x) => {
  console.log(x);
};

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


