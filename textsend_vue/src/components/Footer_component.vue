<template>
    <div id="footer-component">
        <p>Copyright © 
            <span>{{ footer_year }}</span>
            <a href="https://civiccccc.ltd/">
                Ryan
            </a> All Rights Reserved</p>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// 响应式状态
const f_year = reactive({ footer_year: 0 })
const count = ref(0)

// 更改状态、触发更新的函数
function increment() {
  count.value++
}

// 生命周期钩子
onMounted(() => {
  console.log(`计数器初始值为 ${count.value}。`)
})

const Footer_component = {
    data() {
        return {
            footer_year: getFooterYear()
        }
    }
}

const getFooterYear = () => {
    let d = new Date();
    console.log("当前年份："+d.getFullYear());
    return d.getFullYear();
}

</script>

<style scoped>
#footer-component{
    background-color: rgb(182, 255, 255);
    border-style:solid;
    border-width:5px;
    border-color: rgb(164, 255, 157);
    text-align: center;
}
</style>