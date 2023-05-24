<template>
    <div id="footer-component">
        <p>Copyright © 
            <span>{{ footer_year }}</span>
            <a href="https://civiccccc.ltd/">
                Ryan
            </a> All Rights Reserved | Made with  by Colorlib & W3layouts. | Template:Industrie & Coiffure.</p>
    </div>
</template>

<script setup>

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