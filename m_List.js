function List() {
    // 列表的元素个数
    this.listSize = 0;
    // 列表的当前位置 是第几个
    this.pos = 0;

    // 初始化一个空数组来保存列表元素
    this.dataStore = [];
}

List.prototype = {
   
    // 给列表末尾添加元素
    append: function(element) {
        var self = this;
        self.dataStore[this.listSize++] = element;
    },

    // 从列表中删除元素
    remove: function(element) {
        var self = this;
        var curIndex = self.find(element);
        if(curIndex > -1) {
            self.dataStore.splice(curIndex,1);
            --self.listSize;
            return true;
        }
        return false;
    },

    // 查找列表中的元素 返回索引
    find: function(element) {
        var self = this;
        for(var i = 0,dataLen = self.dataStore.length; i < dataLen; i++) {
            if(self.dataStore[i] == element) {
                return i;
            }
        }
        return -1;
    },
   
    // 返回列表中元素的个数
    length: function() {
        return this.listSize;
    },

    // 显示列表中的元素
    toString: function(){
        return this.dataStore;
    },

    /*
     * 在指定元素后面插入一个元素
     * @param element 当前的元素
     * @param elementAfter 把当前的元素插入到此元素后面
     */
    insert: function(element,elementAfter){
        var self = this;
        var insertPos = self.find(elementAfter);
        if(insertPos > -1) {
            self.dataStore.splice(insertPos+1,0,element);
            ++self.listSize;
            return true;
        }
        return false;
    },
   
    // 清空列表中的所有元素
    clear: function() {
        delete this.dataStore;
        this.dataStore = [];
        this.listSize = this.pos = 0;
    },
    // 判断给定的元素是否在列表中
    contains: function(element) {
        var self = this;
        for(var i = 0,ilen = self.dataStore.length; i < ilen; i++) {
            if(self.dataStore[i] == element) {
                return true;
            }
        }
        return false;
    },
    // 将列表中的当前元素移动到第一个位置
    front: function(){
        this.pos = 0;
    },
    // 将列表中当前的元素移动到最后一个位置
    end: function(){
        this.pos = this.listSize - 1;
    },
    // 将当前位置 后移一位
    prev: function(){
        if(this.pos > 0) {
            --this.pos;
        }
    },
    // 将当前位置 前移一位
    next: function(){
        if(this.pos < this.listSize - 1) {
            ++this.pos;
        }
    },
    // 返回列表的当前位置
    curPos: function(){
        return this.pos;
    },
    // 将当前位置移动到指定位置
    moveTo: function(n) {
        this.pos = n;
    },
    // 返回当前位置的元素
    getElement:function(){
        return this.dataStore[this.pos];
    }
};