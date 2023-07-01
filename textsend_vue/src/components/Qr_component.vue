<template>
    <div id="qr-component">
        <!-- <img id="qr_code_img" src="../assets/favicon.png"> -->
    </div>
</template>

<script setup>

</script>

<style scoped>
#qr-component 
{
    float: left;
    width: 400px;
    height: 100%;

    /* debug */
    border-style: solid;
    border-width: 5px;
    border-color: rgb(208, 255, 232);
    background-color: rgb(4, 255, 0);
}

#qr-component::before
{
    float: left;
    padding-top: 200px;
    content: "";

    /* debug */
    border-style: solid;
    border-width: 5px;
    border-color: rgb(208, 255, 232);
    background-color: rgb(44, 121, 43);
}

#qr-component::after
{
    content: "";
    display: block;
    clear: both;

    /* debug */
    border-style: solid;
    border-width: 5px;
    border-color: rgb(208, 255, 232);
    background-color: rgb(53, 134, 51);
}

#qr_code_img {
    height: auto;
}
</style>