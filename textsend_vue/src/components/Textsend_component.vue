<template>
  <div class="textsend-component">
    <div class="textsend-inpt">
      <n-space vertical class="tsTextArea">
        a TODO
        <n-input v-model:value="value" type="textarea" placeholder="基本的 Textarea" />
      </n-space>
    </div>

    <div class="textsend-btns">
      <n-space justify="space-around" size="large">
        <n-select v-model:value="value" :options="ipv4_addr_list" />
        <n-button>Default</n-button>
        <n-button>Default</n-button>
        <n-button>Default</n-button>
        <n-button>Default</n-button>
      </n-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  NSpace,
  NInput,
  NButton,
  NSelect
} from "naive-ui";
import { ref } from "vue";

const value = ref("asd");
const ipv4_addr_list = ref([
  {
    label: "Everybody's Got Something to Hide Except Me and My Monkey",
    value: 'song0',
    disabled: true
  },
  {
    label: 'Drive My Car',
    value: 'song1'
  },
  {
    label: 'Norwegian Wood',
    value: 'song2'
  },
  {
    label: "You Won't See",
    value: 'song3',
    disabled: true
  },
  {
    label: 'Nowhere Man',
    value: 'song4'
  },
  {
    label: 'Think For Yourself',
    value: 'song5'
  },
  {
    label: 'The Word',
    value: 'song6'
  },
  {
    label: 'Michelle',
    value: 'song7',
    disabled: true
  },
  {
    label: 'What goes on',
    value: 'song8'
  },
  {
    label: 'Girl',
    value: 'song9'
  },
  {
    label: "I'm looking through you",
    value: 'song10'
  },
  {
    label: 'In My Life',
    value: 'song11'
  },
  {
    label: 'Wait',
    value: 'song12'
  }
]);



</script>

<!-- <script>
/**
模式:
1.服务端（默认）
获取本机IP
显示二维码
组件：
a.切换模式/发送
b.选择IP 下拉框 其他，可输入TODO
c.启动/停止
d.关于
e.文本框 内容

2.客户端
组件：
a.切换模式/发送
b.文本框 输入IP链接
c.连接/断开
d.关于
e.文本框 内容

 */

import {
  NSpace,
  NInput,
  NButton,
  NSelect,
  NCard,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutSider,
  NLayoutFooter,
} from "naive-ui";

import { defineComponent, ref } from "vue";

export default defineComponent({
  components: {
    NButton,
    NSpace,
    NInput,
    NSelect
  },
  setup() {
    return {
      value: ref(null),
      options: [
        {
          label: "Everybody's Got Something to Hide Except Me and My Monkey",
          value: "song0",
          disabled: true
        },
        {
          label: "Drive My Car",
          value: "song1"
        },
        {
          label: "Norwegian Wood",
          value: "song2"
        },
        {
          label: "You Won't See",
          value: "song3",
          disabled: true
        },
        {
          label: "Nowhere Man",
          value: "song4"
        },
        {
          label: "Think For Yourself",
          value: "song5"
        },
        {
          label: "The Word",
          value: "song6"
        },
        {
          label: "Michelle",
          value: "song7",
          disabled: true
        },
        {
          label: "What goes on",
          value: "song8"
        },
        {
          label: "Girl",
          value: "song9"
        },
        {
          label: "I'm looking through you",
          value: "song10"
        },
        {
          label: "In My Life",
          value: "song11"
        },
        {
          label: "Wait",
          value: "song12"
        }
      ]
    };
  }
});
</script> -->

<style scoped lang="less">
.textsend-component {
  height: 100%;
  width: 100%;
  background-color: bisque;
}

.textsend-inpt {
  width: 100%;
  background-color: violet;
  height: 80%;
}

.textsend-btns {
  width: 100%;
  height: 20%;
  background-color: coral;
}

.tsTextArea {
  height: 100%;
  background-color: darkgray;
}
</style>
