<template>
    <div id="qr-component">
        <img id="qr_code_img" src="../assets/favicon.png">
    </div>
</template>

<script setup>

</script>

<style scoped>
#qr-component{
    float: left;
    border-style:solid;
    border-width:5px;
    border-color: rgb(208, 255, 232);
    background-color: rgb(4, 255, 0);
}

#qr_code_img{
    width: 100px;
    height: 100px;
}
</style>